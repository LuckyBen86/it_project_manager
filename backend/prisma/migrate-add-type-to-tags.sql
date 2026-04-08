-- Migration idempotente : ajout colonne type à tags avec valeur par défaut
DO $$
BEGIN
  -- Créer l'enum TypeTag s'il n'existe pas encore
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TypeTag') THEN
    CREATE TYPE "TypeTag" AS ENUM ('projet', 'tache');
  END IF;

  -- Ajouter la colonne type avec défaut 'projet' si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tags' AND column_name = 'type'
  ) THEN
    ALTER TABLE tags ADD COLUMN type "TypeTag" NOT NULL DEFAULT 'projet';
    -- Supprimer le défaut après population (Prisma gère ça via le schéma)
    ALTER TABLE tags ALTER COLUMN type DROP DEFAULT;
  END IF;

  -- Supprimer l'ancienne contrainte unique sur nom seul si elle existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tags_nom_key' AND conrelid = 'tags'::regclass
  ) THEN
    ALTER TABLE tags DROP CONSTRAINT tags_nom_key;
  END IF;

  -- Ajouter la contrainte unique (nom, type) si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tags_nom_type_key' AND conrelid = 'tags'::regclass
  ) THEN
    ALTER TABLE tags ADD CONSTRAINT tags_nom_type_key UNIQUE (nom, type);
  END IF;
END $$;
