-- Migration : un responsable peut gérer plusieurs pôles
-- Crée la table responsable_poles et migre les données depuis responsable_pole_id

CREATE TABLE IF NOT EXISTS responsable_poles (
  ressource_id TEXT NOT NULL REFERENCES ressources(id) ON DELETE CASCADE,
  pole_id      TEXT NOT NULL REFERENCES poles(id)      ON DELETE CASCADE,
  PRIMARY KEY (ressource_id, pole_id)
);

-- Migrer les données existantes
INSERT INTO responsable_poles (ressource_id, pole_id)
SELECT id, responsable_pole_id
FROM ressources
WHERE responsable_pole_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Supprimer l'ancienne colonne
ALTER TABLE ressources DROP COLUMN IF EXISTS responsable_pole_id;
