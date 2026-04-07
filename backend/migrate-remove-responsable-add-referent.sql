-- Migration : suppression du champ responsable_id, ajout du champ referent_id (optionnel)
-- Les projets existants n'auront plus de responsable ; le referent_id sera null par défaut.

ALTER TABLE projets DROP COLUMN IF EXISTS responsable_id;

ALTER TABLE projets
  ADD COLUMN IF NOT EXISTS referent_id UUID REFERENCES ressources(id) ON DELETE SET NULL;
