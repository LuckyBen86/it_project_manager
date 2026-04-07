-- Migration: replace tag.type (enum) with tag_types junction table

-- 1. Create junction table
CREATE TABLE "tag_types" (
  "tag_id"  TEXT NOT NULL,
  "type"    TEXT NOT NULL,
  CONSTRAINT "tag_types_pkey" PRIMARY KEY ("tag_id", "type"),
  CONSTRAINT "tag_types_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
);

-- 2. Migrate existing single-type data into junction table
INSERT INTO "tag_types" ("tag_id", "type")
SELECT "id", "type" FROM "tags";

-- 3. Merge tags with identical nom but different type (avoid unique(nom) conflict)
DO $$
DECLARE
  dup_nom TEXT;
  keep_id TEXT;
  dup_id  TEXT;
BEGIN
  FOR dup_nom IN
    SELECT nom FROM tags GROUP BY nom HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO keep_id FROM tags WHERE nom = dup_nom ORDER BY created_at LIMIT 1;
    FOR dup_id IN
      SELECT id FROM tags WHERE nom = dup_nom AND id <> keep_id
    LOOP
      INSERT INTO tag_types (tag_id, type)
        SELECT keep_id, type FROM tag_types WHERE tag_id = dup_id
        ON CONFLICT DO NOTHING;
      UPDATE projet_tags SET tag_id = keep_id WHERE tag_id = dup_id;
      UPDATE tache_tags  SET tag_id = keep_id WHERE tag_id = dup_id;
      DELETE FROM tag_types WHERE tag_id = dup_id;
      DELETE FROM tags WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;

-- 4. Drop old unique(nom, type), add unique(nom)
ALTER TABLE "tags" DROP CONSTRAINT IF EXISTS "tags_nom_type_key";
ALTER TABLE "tags" ADD  CONSTRAINT "tags_nom_key" UNIQUE ("nom");

-- 5. Drop the type column
ALTER TABLE "tags" DROP COLUMN "type";
