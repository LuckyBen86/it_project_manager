-- Migration idempotente : ajout du champ pole sur les projets
DO $$
BEGIN
  -- Créer l'enum Pole s'il n'existe pas encore
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Pole') THEN
    CREATE TYPE "Pole" AS ENUM ('dev', 'infra');
  END IF;

  -- Ajouter la colonne pole sur projets si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projets' AND column_name = 'pole'
  ) THEN
    ALTER TABLE projets ADD COLUMN pole "Pole";
  END IF;
END $$;
