#!/bin/sh
set -e

echo "→ Migration renommage categorie -> tag..."
psql "$DATABASE_URL" -f /app/prisma/migrate-categorie-to-tags.sql

echo "→ Migration ajout champ pole..."
psql "$DATABASE_URL" -f /app/prisma/migrate-add-pole.sql

echo "→ Migration référent (suppression responsable_id)..."
psql "$DATABASE_URL" -f /app/prisma/migrate-remove-responsable-add-referent.sql

echo "→ Migration responsable multi-pôles..."
psql "$DATABASE_URL" -f /app/prisma/migrate-responsable-multi-poles.sql

echo "→ Migration logiciel → catégorie + associations pôles..."
psql "$DATABASE_URL" -f /app/prisma/migrate-logiciel-to-categorie-and-poles.sql

echo "→ Synchronisation du schéma BDD..."
npx prisma db push --accept-data-loss

echo "→ Seed initial..."
node dist/seed.js

echo "→ Démarrage du serveur..."
exec node dist/index.js
