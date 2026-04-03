-- Migration idempotente : renommage categorie -> tag
DO $$
BEGIN
  -- Renommer l'enum TypeCategorie en TypeTag
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TypeCategorie') THEN
    ALTER TYPE "TypeCategorie" RENAME TO "TypeTag";
  END IF;

  -- Renommer la table categories en tags
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
    ALTER TABLE categories RENAME TO tags;
  END IF;

  -- Renommer la colonne categorie_id en tag_id dans projets
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projets' AND column_name = 'categorie_id') THEN
    ALTER TABLE projets RENAME COLUMN categorie_id TO tag_id;
  END IF;

  -- Renommer la colonne categorie_id en tag_id dans taches
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'taches' AND column_name = 'categorie_id') THEN
    ALTER TABLE taches RENAME COLUMN categorie_id TO tag_id;
  END IF;
END $$;

-- Migration idempotente : passage de 1 tag -> N tags (many-to-many)
DO $$
BEGIN
  -- Créer la table de jonction projet_tags
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projet_tags') THEN
    CREATE TABLE projet_tags (
      projet_id TEXT NOT NULL,
      tag_id    TEXT NOT NULL,
      PRIMARY KEY (projet_id, tag_id),
      FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
  END IF;

  -- Migrer les données existantes de tag_id vers projet_tags
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projets' AND column_name = 'tag_id') THEN
    INSERT INTO projet_tags (projet_id, tag_id)
    SELECT id, tag_id FROM projets WHERE tag_id IS NOT NULL
    ON CONFLICT DO NOTHING;
    ALTER TABLE projets DROP COLUMN tag_id;
  END IF;

  -- Créer la table de jonction tache_tags
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tache_tags') THEN
    CREATE TABLE tache_tags (
      tache_id TEXT NOT NULL,
      tag_id   TEXT NOT NULL,
      PRIMARY KEY (tache_id, tag_id),
      FOREIGN KEY (tache_id) REFERENCES taches(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
  END IF;

  -- Migrer les données existantes de tag_id vers tache_tags
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'taches' AND column_name = 'tag_id') THEN
    INSERT INTO tache_tags (tache_id, tag_id)
    SELECT id, tag_id FROM taches WHERE tag_id IS NOT NULL
    ON CONFLICT DO NOTHING;
    ALTER TABLE taches DROP COLUMN tag_id;
  END IF;
END $$;
