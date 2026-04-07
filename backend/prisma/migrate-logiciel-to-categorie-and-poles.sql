-- Renommage logiciels -> categories
ALTER TABLE IF EXISTS logiciels RENAME TO categories;
ALTER TABLE IF EXISTS projet_logiciels RENAME TO projet_categories;
ALTER TABLE IF EXISTS projet_categories RENAME COLUMN logiciel_id TO categorie_id;

-- Tables d'association pôles
CREATE TABLE IF NOT EXISTS categorie_poles (
  categorie_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  pole_id      TEXT NOT NULL REFERENCES poles(id)      ON DELETE CASCADE,
  PRIMARY KEY (categorie_id, pole_id)
);

CREATE TABLE IF NOT EXISTS tag_poles (
  tag_id  TEXT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  pole_id TEXT NOT NULL REFERENCES poles(id) ON DELETE CASCADE,
  PRIMARY KEY (tag_id, pole_id)
);
