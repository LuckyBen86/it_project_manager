-- Migration: add avancement fields to taches and projets

ALTER TABLE "taches"
  ADD COLUMN "avancement_tache"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "avancement_auto_tache" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "projets"
  ADD COLUMN "avancement_projet"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "avancement_auto_projet" BOOLEAN NOT NULL DEFAULT true;
