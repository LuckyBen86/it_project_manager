#!/bin/sh
set -e

echo "→ Synchronisation du schéma BDD..."
npx prisma db push --skip-generate

echo "→ Seed initial..."
node dist/seed.js

echo "→ Démarrage du serveur..."
exec node dist/index.js
