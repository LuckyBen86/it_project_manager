import { Router, Response, Request } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { traiterDemandeSchema } from '../schemas/demande.schema.js';
import { logAction } from '../lib/journal.js';
import { STATUT_LABELS_FR } from '../lib/labels.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('responsable', 'direction_generale'));

function projetWhereForManager(role: string, responsablePoleIds?: string[]) {
  if (role === 'direction_generale') return { deletedAt: null };
  return { deletedAt: null, poleId: { in: responsablePoleIds ?? [] } };
}

// GET /demandes — demandes en_attente sur les projets du responsable/DG
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { role, responsablePoleIds } = req.user!;
  const demandes = await prisma.demandeValidation.findMany({
    where: {
      statut: 'en_attente',
      tache: {
        deletedAt: null,
        projet: projetWhereForManager(role, responsablePoleIds),
      },
    },
    include: {
      tache: { select: { id: true, titre: true, statut: true, duree: true, dateDebut: true, projetId: true, projet: { select: { id: true, titre: true } } } },
      auteur: { select: { id: true, nom: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(demandes);
});

// PATCH /demandes/:id/traiter — valider ou refuser
router.patch('/:id/traiter', validate(traiterDemandeSchema), async (req: AuthRequest & Request<{ id: string }>, res: Response): Promise<void> => {
  const { sub: userId, role, responsablePoleIds } = req.user!;

  const projetWhere = projetWhereForManager(role, responsablePoleIds);
  const demande = await prisma.demandeValidation.findFirst({
    where: {
      id: req.params.id,
      statut: 'en_attente',
      tache: { projet: projetWhere },
    },
    include: { tache: true },
  });

  if (!demande) { res.status(404).json({ message: 'Demande introuvable ou déjà traitée' }); return; }

  const { action, commentaireRefus } = req.body;
  const tache = demande.tache;

  if (action === 'valider') {
    let tacheUpdate: Record<string, unknown> = {};
    if (demande.type === 'terminer') {
      tacheUpdate = { statut: 'termine' };
    } else if (demande.type === 'modifier_duree') {
      tacheUpdate = { duree: parseInt(demande.valeurDemandee!, 10) };
    } else if (demande.type === 'modifier_date_debut') {
      tacheUpdate = { dateDebut: demande.valeurDemandee ? new Date(demande.valeurDemandee) : null };
    }

    await prisma.demandeValidation.update({
      where: { id: demande.id },
      data: { statut: 'valide' },
    });

    if (demande.type === 'terminer') {
      await logAction({
        auteurId: userId,
        action: 'STATUT_TACHE',
        entityId: tache.id,
        entityTitre: tache.titre,
        ancienneValeur: STATUT_LABELS_FR[tache.statut] ?? tache.statut,
        nouvelleValeur: STATUT_LABELS_FR['termine'],
      });
    }

    const remainingCount = await prisma.demandeValidation.count({
      where: { tacheId: tache.id, statut: 'en_attente', id: { not: demande.id } },
    });
    await prisma.tache.update({
      where: { id: tache.id },
      data: { ...tacheUpdate, enAttenteValidation: remainingCount > 0 },
    });

  } else {
    let tacheUpdate: Record<string, unknown> = {};
    if (demande.type === 'terminer' && demande.statutOrigine) {
      tacheUpdate = { statut: demande.statutOrigine as 'a_faire' | 'en_cours' };
    }

    await prisma.demandeValidation.update({
      where: { id: demande.id },
      data: { statut: 'refuse', commentaireRefus: commentaireRefus ?? null },
    });

    const remainingCount = await prisma.demandeValidation.count({
      where: { tacheId: tache.id, statut: 'en_attente', id: { not: demande.id } },
    });
    await prisma.tache.update({
      where: { id: tache.id },
      data: { ...tacheUpdate, enAttenteValidation: remainingCount > 0 },
    });
  }

  res.json({ message: action === 'valider' ? 'Demande validée' : 'Demande refusée' });
});

export default router;
