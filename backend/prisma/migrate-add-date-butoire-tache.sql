-- Migration idempotente : ajout du champ date_butoire sur les tâches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'taches' AND column_name = 'date_butoire'
  ) THEN
    ALTER TABLE taches ADD COLUMN date_butoire TIMESTAMP(3);
  END IF;
END $$;
