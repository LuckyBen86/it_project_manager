-- Migration : poles table, direction_generale role, ressource_poles, responsable_pole_id
-- Idempotent — safe to run multiple times

DO $$
BEGIN

  -- 1. Create poles table
  CREATE TABLE IF NOT EXISTS poles (
    id   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nom  TEXT NOT NULL UNIQUE
  );

  -- 2. Seed default poles
  INSERT INTO poles (nom) VALUES ('dev')   ON CONFLICT (nom) DO NOTHING;
  INSERT INTO poles (nom) VALUES ('infra') ON CONFLICT (nom) DO NOTHING;

  -- 3. Add pole_id column to projets (nullable first)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projets' AND column_name = 'pole_id'
  ) THEN
    ALTER TABLE projets ADD COLUMN pole_id TEXT;
  END IF;

  -- 4. Migrate existing pole enum values to pole_id FK
  UPDATE projets p
  SET pole_id = poles.id
  FROM poles
  WHERE p.pole_id IS NULL
    AND poles.nom = p.pole::text
    AND p.pole IS NOT NULL;

  -- 5. Default remaining NULL pole_id to 'dev'
  UPDATE projets
  SET pole_id = (SELECT id FROM poles WHERE nom = 'dev')
  WHERE pole_id IS NULL;

  -- 6. Make pole_id NOT NULL and add FK constraint
  ALTER TABLE projets ALTER COLUMN pole_id SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'projets' AND constraint_name = 'projets_pole_id_fkey'
  ) THEN
    ALTER TABLE projets ADD CONSTRAINT projets_pole_id_fkey
      FOREIGN KEY (pole_id) REFERENCES poles(id);
  END IF;

  -- 7. Drop old pole enum column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projets' AND column_name = 'pole'
  ) THEN
    ALTER TABLE projets DROP COLUMN pole;
  END IF;

  -- 8. Add direction_generale to Role enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'direction_generale'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'direction_generale';
  END IF;

  -- 9. Update admin user role to direction_generale
  UPDATE ressources
  SET role = 'direction_generale'
  WHERE email = 'admin@it-pm.local';

  -- 10. Create ressource_poles junction table
  CREATE TABLE IF NOT EXISTS ressource_poles (
    ressource_id TEXT NOT NULL REFERENCES ressources(id) ON DELETE CASCADE,
    pole_id      TEXT NOT NULL REFERENCES poles(id)      ON DELETE CASCADE,
    PRIMARY KEY (ressource_id, pole_id)
  );

  -- 11. Add responsable_pole_id to ressources
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ressources' AND column_name = 'responsable_pole_id'
  ) THEN
    ALTER TABLE ressources ADD COLUMN responsable_pole_id TEXT
      REFERENCES poles(id);
  END IF;

  -- 12. Assign all existing responsables to 'dev' pole as management pole
  UPDATE ressources
  SET responsable_pole_id = (SELECT id FROM poles WHERE nom = 'dev')
  WHERE role = 'responsable'
    AND responsable_pole_id IS NULL;

  -- 13. Seed ressource_poles: assign all users to 'dev' by default
  INSERT INTO ressource_poles (ressource_id, pole_id)
  SELECT r.id, p.id
  FROM ressources r, poles p
  WHERE p.nom = 'dev'
    AND NOT EXISTS (
      SELECT 1 FROM ressource_poles rp
      WHERE rp.ressource_id = r.id AND rp.pole_id = p.id
    );

END $$;
