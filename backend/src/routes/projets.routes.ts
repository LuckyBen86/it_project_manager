import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createProjetSchema,
  updateProjetSchema,
  updateGanttSchema,
} from '../schemas/projet.schema.js';
import { logAction } from '../lib/journal.js';
import { STATUT_LABELS_FR, formatDateFr } from '../lib/labels.js';

const router = Router();
router.use(authenticate);

const PROJET_INCLUDE = {
  referent: { select: { id: true, nom: true, email: true } },
  pole: { select: { id: true, nom: true } },
  tags:       { select: { tag: true } },
  categories: { select: { categorie: true } },
  taches: {
    where: { deletedAt: null },
    include: {
      tags: { select: { tag: true } },
      ressources: { include: { ressource: { select: { id: true, nom: true } } } },
      dependances: { include: { precedent: { select: { id: true, titre: true } } } },
      activites: { select: { duree: true } },
    },
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenTags(obj: any): any {
  const result = {
    ...obj,
    tags:       (obj.tags       ?? []).map((pt: any) => pt.tag),
    categories: (obj.categories ?? []).map((pc: any) => pc.categorie),
  };
  if (result.taches) {
    result.taches = result.taches.map((t: any) => ({ ...t, tags: (t.tags ?? []).map((tt: any) => tt.tag) }));
  }
  return result;
}

function projetWhereForUser(userId: string, role: string, responsablePoleIds?: string[]) {
  if (role === 'direction_generale') return { deletedAt: null };
  if (role === 'responsable') {
    return {
      deletedAt: null,
      poleId: { in: responsablePoleIds ?? [] },
    };
  }
  // utilisateur : projets où il est assigné à au moins une tâche OU est référent
  return {
    deletedAt: null,
    OR: [
      { taches: { some: { deletedAt: null, ressources: { some: { ressourceId: userId } } } } },
      { referentId: userId },
    ],
  };
}

async function isReferentOfProjet(userId: string, projetId: string): Promise<boolean> {
  const projet = await prisma.projet.findFirst({ where: { id: projetId, deletedAt: null, referentId: userId } });
  return !!projet;
}

function canManageProjet(role: string): boolean {
  return role === 'responsable' || role === 'direction_generale';
}

// GET /projets
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { sub: userId, role, responsablePoleIds } = req.user!;
  const projets = await prisma.projet.findMany({
    where: projetWhereForUser(userId, role, responsablePoleIds),
    include: PROJET_INCLUDE,
    orderBy: { dateButoire: 'asc' },
  });
  res.json(projets.map(flattenTags));
});

// GET /projets/:id
router.get('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const projet = await prisma.projet.findFirst({
    where: { id: req.params.id, deletedAt: null },
    include: PROJET_INCLUDE,
  });
  if (!projet) { res.status(404).json({ message: 'Projet introuvable' }); return; }
  res.json(flattenTags(projet));
});

// POST /projets — responsable ou direction_generale
router.post('/', requireRole('responsable', 'direction_generale'), validate(createProjetSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const { tagIds, categorieIds, ...data } = req.body;
  const projet = await prisma.projet.create({
    data: {
      ...data,
      tags: tagIds?.length
        ? { create: tagIds.map((id: string) => ({ tagId: id })) }
        : undefined,
      categories: categorieIds?.length
        ? { create: categorieIds.map((id: string) => ({ categorieId: id })) }
        : undefined,
    },
    include: PROJET_INCLUDE,
  });
  res.status(201).json(flattenTags(projet));
});

// PATCH /projets/:id — responsable, direction_generale, ou référent du projet
router.patch('/:id', validate(updateProjetSchema), async (req: AuthRequest & Request<{ id: string }>, res: Response): Promise<void> => {
  const { sub: userId, role, responsablePoleIds } = req.user!;

  const existing = await prisma.projet.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) { res.status(404).json({ message: 'Projet introuvable' }); return; }

  const referent = existing.referentId === userId;
  const manager = canManageProjet(role);

  if (!manager && !referent) {
    res.status(403).json({ message: 'Accès refusé : droits insuffisants' });
    return;
  }

  // Responsable : ne peut modifier que les projets de ses pôles
  if (role === 'responsable' && !responsablePoleIds?.includes(existing.poleId)) {
    res.status(403).json({ message: 'Accès refusé : ce projet n\'appartient pas à vos pôles' });
    return;
  }

  const { tagIds, categorieIds, ...body } = req.body;

  const dateDebutResultante = body.dateDebut !== undefined ? body.dateDebut : existing.dateDebut;
  const statutExplicite: string = body.statut ?? existing.statut;
  const updateData = (dateDebutResultante && statutExplicite !== 'termine')
    ? { ...body, statut: 'planifie' }
    : body;

  const projet = await prisma.projet.update({
    where: { id: req.params.id },
    data: {
      ...updateData,
      ...(tagIds !== undefined ? {
        tags: { deleteMany: {}, create: tagIds.map((id: string) => ({ tagId: id })) },
      } : {}),
      ...(categorieIds !== undefined ? {
        categories: { deleteMany: {}, create: categorieIds.map((id: string) => ({ categorieId: id })) },
      } : {}),
    },
    include: PROJET_INCLUDE,
  });

  if (projet.statut !== existing.statut) {
    await logAction({
      auteurId: userId,
      action: 'STATUT_PROJET',
      entityId: projet.id,
      entityTitre: projet.titre,
      ancienneValeur: STATUT_LABELS_FR[existing.statut] ?? existing.statut,
      nouvelleValeur: STATUT_LABELS_FR[projet.statut] ?? projet.statut,
    });
  }
  if (body.dateDebut !== undefined) {
    const ancien = existing.dateDebut?.toISOString() ?? null;
    const nouveau = body.dateDebut ?? null;
    if (ancien !== nouveau) {
      await logAction({
        auteurId: userId,
        action: 'DATE_DEBUT_PROJET',
        entityId: projet.id,
        entityTitre: projet.titre,
        ancienneValeur: ancien ? formatDateFr(ancien) : null,
        nouvelleValeur: nouveau ? formatDateFr(nouveau) : null,
      });
    }
  }

  res.json(flattenTags(projet));
});

// PATCH /projets/:id/gantt — responsable, direction_generale, ou référent du projet
router.patch('/:id/gantt', validate(updateGanttSchema), async (req: AuthRequest & Request<{ id: string }>, res: Response): Promise<void> => {
  const { sub: userId, role, responsablePoleIds } = req.user!;

  const existing = await prisma.projet.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) { res.status(404).json({ message: 'Projet introuvable' }); return; }

  const referent = existing.referentId === userId;
  const manager = canManageProjet(role);

  if (!manager && !referent) {
    res.status(403).json({ message: 'Accès refusé : droits insuffisants' });
    return;
  }

  if (role === 'responsable' && !responsablePoleIds?.includes(existing.poleId)) {
    res.status(403).json({ message: 'Accès refusé : ce projet n\'appartient pas à vos pôles' });
    return;
  }

  const dateDebutResultante = req.body.dateDebut !== undefined ? req.body.dateDebut : existing.dateDebut;
  const updateData = (dateDebutResultante && existing.statut !== 'termine')
    ? { ...req.body, statut: 'planifie' }
    : req.body;

  const projet = await prisma.projet.update({
    where: { id: req.params.id },
    data: updateData,
    include: PROJET_INCLUDE,
  });

  if (projet.statut !== existing.statut) {
    await logAction({
      auteurId: userId,
      action: 'STATUT_PROJET',
      entityId: projet.id,
      entityTitre: projet.titre,
      ancienneValeur: STATUT_LABELS_FR[existing.statut] ?? existing.statut,
      nouvelleValeur: STATUT_LABELS_FR[projet.statut] ?? projet.statut,
    });
  }
  if (req.body.dateDebut !== undefined) {
    const ancien = existing.dateDebut?.toISOString() ?? null;
    const nouveau = req.body.dateDebut ?? null;
    if (ancien !== nouveau) {
      await logAction({
        auteurId: userId,
        action: 'DATE_DEBUT_PROJET',
        entityId: projet.id,
        entityTitre: projet.titre,
        ancienneValeur: ancien ? formatDateFr(ancien) : null,
        nouvelleValeur: nouveau ? formatDateFr(nouveau) : null,
      });
    }
  }

  res.json(flattenTags(projet));
});

// DELETE /projets/:id — soft delete — responsable ou direction_generale uniquement (pas le référent)
router.delete('/:id', requireRole('responsable', 'direction_generale'), async (req: AuthRequest & Request<{ id: string }>, res: Response): Promise<void> => {
  const auteurId = req.user!.sub;
  const existing = await prisma.projet.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) { res.status(404).json({ message: 'Projet introuvable' }); return; }

  if (req.user!.role === 'responsable' && !req.user!.responsablePoleIds?.includes(existing.poleId)) {
    res.status(403).json({ message: 'Accès refusé : ce projet n\'appartient pas à vos pôles' });
    return;
  }

  // RG-PROJET-04 : interdiction si au moins une tâche contient des activités
  const activiteCount = await prisma.activite.count({
    where: { tache: { projetId: req.params.id, deletedAt: null } },
  });
  if (activiteCount > 0) {
    res.status(409).json({ message: 'Impossible de supprimer ce projet : au moins une de ses tâches contient des activités de saisie.' });
    return;
  }

  const deletedAt = new Date();

  await logAction({
    auteurId,
    action: 'SUPPRESSION_PROJET',
    entityId: existing.id,
    entityTitre: existing.titre,
  });

  await prisma.projet.update({
    where: { id: req.params.id },
    data: { deletedAt, deletedById: auteurId },
  });

  await prisma.tache.updateMany({
    where: { projetId: req.params.id, deletedAt: null },
    data: { deletedAt, deletedById: auteurId, deletedWithProjetId: req.params.id },
  });

  res.status(204).send();
});

export { isReferentOfProjet };
export default router;
