import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import projetsRoutes from './routes/projets.routes.js';
import tachesRoutes from './routes/taches.routes.js';
import ressourcesRoutes from './routes/ressources.routes.js';
import tagsRoutes from './routes/categories.routes.js';
import activitesRoutes from './routes/activites.routes.js';
import mesTachesRoutes from './routes/mes-taches.routes.js';
import journalRoutes from './routes/journal.routes.js';
import corbeilleRoutes from './routes/corbeille.routes.js';
import logicielsRoutes from './routes/logiciels.routes.js';
import demandesRoutes from './routes/demandes.routes.js';
import mesDemandesRoutes from './routes/mes-demandes.routes.js';
import syntheseRoutes from './routes/synthese.routes.js';
import polesRoutes from './routes/poles.routes.js';

const app = express();
const PORT = process.env.PORT ?? 4000;

// En dev, accepte localhost:5173. En prod Docker, les appels viennent de nginx
// qui proxie depuis le même host, donc origin = FRONTEND_URL.
const allowedOrigins = [
  process.env.FRONTEND_URL ?? 'http://localhost',
  'http://localhost:5173',
  'http://localhost:80',
  'http://localhost',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Pas d'origin (curl, Postman, appels internes)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloqué : ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/auth', authRoutes);
app.use('/projets', projetsRoutes);
app.use('/projets/:projetId/taches', tachesRoutes);
app.use('/ressources', ressourcesRoutes);
app.use('/tags', tagsRoutes);
app.use('/activites', activitesRoutes);
app.use('/mes-taches', mesTachesRoutes);
app.use('/journal', journalRoutes);
app.use('/corbeille', corbeilleRoutes);
app.use('/logiciels', logicielsRoutes);
app.use('/demandes', demandesRoutes);
app.use('/mes-demandes', mesDemandesRoutes);
app.use('/synthese', syntheseRoutes);
app.use('/poles', polesRoutes);

// 404
app.use((_req, res) => res.status(404).json({ message: 'Route introuvable' }));

// Erreur globale
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`Backend démarré sur le port ${PORT}`);
});

export default app;
