import { Router, Response, Request } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { logAction } from '../lib/journal.js';
import { STATUT_LABELS_FR } from '../lib/labels.js';
import { createDemandeSchema } from '../schemas/demande.schema.js';

const router = Router();
router.use((req, _res, next) => { console.log(`[mes-taches] ${req.method} ${req.path}`, JSON.stringify(req.body)); next(); });
router.use(authenticate);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flattenTags = (t: any) => ({ ...t, tags: (t.tags ?? []).map((tt: any) => tt.tag) });

const MES_TACHES_INCLUDE = {
  projet: { select: { id: true, titre: true, statut: true, pole: true } },
  tags: { select: { tag: true } },
  ressources: { include: { ressource: { select: { id: true, nom: true } } } },
  activites: {
    select: { id: true, description: true, date: true, duree: true, ressource: { select: { id: true, nom: true, email: true } } },
    orderBy: { date: 'desc' as const },
  },
};

// GET /mes-taches
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const taches = await prisma.tache.findMany({
    where: { ressources: { some: { ressourceId: req.user!.sub } }, deletedAt: null },
    include: MES_TACHES_INCLUDE,
    orderBy: [{ statut: 'asc' }, { dateDebut: 'asc' }],
  });
  res.json(taches.map(flattenTags));
});

// POST /mes-taches/:tacheId/activites
const addActiviteSchema = z.object({
  description: z.string().min(1, 'Description requise'),
  date: z.string().min(1),
  duree: z.number().positive().multipleOf(0.01),
});

router.post('/:tacheId/activites', validate(addActiviteSchema), async (req: AuthRequest & Request<{ tacheId: string }>, res: Response): Promise<void> => {
  const tacheId = req.params.tacheId;
  const assignment = await prisma.tacheRessource.findUnique({
    where: { tacheId_ressourceId: { tacheId, ressourceId: req.user!.sub } },
  });
  if (!assignment) { res.status(403).json({ message: 'Non assigné à cette tâche' }); return; }

  const tache = await prisma.tache.findUnique({ where: { id: tacheId }, select: { statut: true, deletedAt: true } });
  if (!tache || tache.deletedAt) { res.status(404).json({ message: 'Tâche introuvable' }); return; }
  if (tache.statut === 'termine') { res.status(403).json({ message: 'Impossible d\'ajouter une activité sur une tâche terminée' }); return; }

  const activite = await prisma.activite.create({
    data: { description: req.body.description, date: req.body.date, duree: req.body.duree, ressourceId: req.user!.sub, tacheId },
    include: { ressource: { select: { id: true, nom: true, email: true } } },
  });
  res.status(201).json(activite);
});

// PATCH /mes-taches/:tacheId/activites/:activiteId
const updateActiviteSchema = z.object({
  description: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  duree: z.number().positive().optional(),
});

router.patch('/:tacheId/activites/:activiteId', validate(updateActiviteSchema), async (req: AuthRequest & Request<{ tacheId: string; activiteId: string }>, res: Response): Promise<void> => {
  try {
    const { tacheId, activiteId } = req.params;
    console.log('[PATCH activite] params:', tacheId, activiteId, 'user:', req.user?.sub);
    const activite = await prisma.activite.findUnique({ where: { id: activiteId } });
    console.log('[PATCH activite] found:', activite?.id, 'tacheId match:', activite?.tacheId === tacheId, 'ressource match:', activite?.ressourceId === req.user!.sub);
    if (!activite || activite.tacheId !== tacheId || activite.ressourceId !== req.user!.sub) {
      res.status(403).json({ message: 'Non autorisé' }); return;
    }
    const updated = await prisma.activite.update({
      where: { id: activiteId },
      data: req.body,
      include: { ressource: { select: { id: true, nom: true, email: true } } },
    });
    res.json(updated);
  } catch (err) {
    console.error('[PATCH activite error]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PATCH /mes-taches/:tacheId/statut
const updateStatutSchema = z.object({
  statut: z.enum(['a_faire', 'en_cours', 'termine']),
});

router.patch('/:tacheId/statut', validate(updateStatutSchema), async (req: AuthRequest & Request<{ tacheId: string }>, res: Response): Promise<void> => {
  const tacheId = req.params.tacheId;
  const assignment = await prisma.tacheRessource.findUnique({
    where: { tacheId_ressourceId: { tacheId, ressourceId: req.user!.sub } },
  });
  if (!assignment) { res.status(403).json({ message: 'Non assigné à cette tâche' }); return; }

  const existing = await prisma.tache.findUnique({ where: { id: tacheId }, select: { statut: true, titre: true, deletedAt: true } });
  if (!existing || existing.deletedAt) { res.status(404).json({ message: 'Tâche introuvable' }); return; }

  const tache = await prisma.tache.update({
    where: { id: tacheId },
    data: { statut: req.body.statut },
    include: MES_TACHES_INCLUDE,
  });

  if (existing && existing.statut !== req.body.statut) {
    await logAction({
      auteurId: req.user!.sub,
      action: 'STATUT_TACHE',
      entityId: tacheId,
      entityTitre: existing.titre,
      ancienneValeur: STATUT_LABELS_FR[existing.statut] ?? existing.statut,
      nouvelleValeur: STATUT_LABELS_FR[req.body.statut] ?? req.body.statut,
    });
  }

  res.json(flattenTags(tache));
});

// POST /mes-taches/:tacheId/demandes — créer une demande de validation
router.post('/:tacheId/demandes', validate(createDemandeSchema), async (req: AuthRequest & Request<{ tacheId: string }>, res: Response): Promise<void> => {
  const tacheId = req.params.tacheId;
  const auteurId = req.user!.sub;

  // Vérifier l'assignation
  const assignment = await prisma.tacheRessource.findUnique({
    where: { tacheId_ressourceId: { tacheId, ressourceId: auteurId } },
  });
  if (!assignment) { res.status(403).json({ message: 'Non assigné à cette tâche' }); return; }

  const tache = await prisma.tache.findUnique({
    where: { id: tacheId },
    select: { statut: true, deletedAt: true, titre: true, projet: { select: { dateDebut: true } } },
  });
  if (!tache || tache.deletedAt) { res.status(404).json({ message: 'Tâche introuvable' }); return; }

  const { type, valeurDemandee } = req.body;

  // Validations métier
  if (type === 'terminer' && tache.statut === 'termine') {
    res.status(400).json({ message: 'La tâche est déjà terminée' }); return;
  }
  if (type === 'modifier_duree') {
    const val = parseInt(valeurDemandee ?? '', 10);
    if (!valeurDemandee || isNaN(val) || val < 1) {
      res.status(400).json({ message: 'Durée invalide (entier ≥ 1)' }); return;
    }
  }
  if (type === 'modifier_date_debut') {
    if (!valeurDemandee || isNaN(new Date(valeurDemandee).getTime())) {
      res.status(400).json({ message: 'Date invalide' }); return;
    }
    if (tache.projet?.dateDebut && new Date(valeurDemandee) < tache.projet.dateDebut) {
      res.status(400).json({ message: 'La date de début de la tâche ne peut pas être antérieure à celle du projet.' }); return;
    }
  }

  const demande = await prisma.demandeValidation.create({
    data: {
      tacheId,
      auteurId,
      type,
      valeurDemandee: valeurDemandee ?? null,
      statutOrigine: type === 'terminer' ? tache.statut : null,
    },
  });

  // Poser le flag sur la tâche
  await prisma.tache.update({
    where: { id: tacheId },
    data: { enAttenteValidation: true },
  });

  res.status(201).json(demande);
});

export default router;
