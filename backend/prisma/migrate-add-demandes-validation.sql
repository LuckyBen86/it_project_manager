-- Migration idempotente : ajout du système de demandes de validation

DO $$
BEGIN
  -- Colonne en_attente_validation sur taches
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'taches' AND column_name = 'en_attente_validation'
  ) THEN
    ALTER TABLE taches ADD COLUMN en_attente_validation BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- Enum TypeDemande
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TypeDemande') THEN
    CREATE TYPE "TypeDemande" AS ENUM ('terminer', 'modifier_duree', 'modifier_date_debut');
  END IF;

  -- Enum StatutDemande
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatutDemande') THEN
    CREATE TYPE "StatutDemande" AS ENUM ('en_attente', 'valide', 'refuse');
  END IF;

  -- Table demande_validations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'demande_validations'
  ) THEN
    CREATE TABLE demande_validations (
      id                   TEXT        NOT NULL PRIMARY KEY,
      tache_id             TEXT        NOT NULL REFERENCES taches(id) ON DELETE CASCADE ON UPDATE CASCADE,
      auteur_id            TEXT        NOT NULL REFERENCES ressources(id) ON DELETE CASCADE ON UPDATE CASCADE,
      type                 "TypeDemande" NOT NULL,
      statut               "StatutDemande" NOT NULL DEFAULT 'en_attente',
      valeur_demandee      TEXT,
      statut_origine       TEXT,
      commentaire_refus    TEXT,
      archived_by_auteur   BOOLEAN NOT NULL DEFAULT false,
      created_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at           TIMESTAMP(3) NOT NULL
    );
  END IF;
END $$;
