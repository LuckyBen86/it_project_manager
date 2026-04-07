#!/bin/sh
set -e

echo "→ Synchronisation du schéma BDD..."
npx prisma db push --accept-data-loss

echo "→ Migrations SQL (ignorées si déjà appliquées)..."
psql "$DATABASE_URL" -f /app/prisma/migrate-categorie-to-tags.sql || true
psql "$DATABASE_URL" -f /app/prisma/migrate-add-pole.sql || true
psql "$DATABASE_URL" -f /app/prisma/migrate-add-roles-poles.sql || true
psql "$DATABASE_URL" -f /app/prisma/migrate-remove-responsable-add-referent.sql || true
psql "$DATABASE_URL" -f /app/prisma/migrate-responsable-multi-poles.sql || true
psql "$DATABASE_URL" -f /app/prisma/migrate-logiciel-to-categorie-and-poles.sql || true
psql "$DATABASE_URL" -f /app/prisma/migrate-add-demandes-validation.sql || true
psql "$DATABASE_URL" -f /app/prisma/migrate-add-date-butoire-tache.sql || true
psql "$DATABASE_URL" -f /app/prisma/migrations/20260407000000_add_logged_out_at/migration.sql || true

echo "→ Seed initial..."
node dist/seed.js || true

echo "→ Démarrage du serveur..."
exec node dist/index.js
