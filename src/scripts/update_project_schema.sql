DO $$
BEGIN
  -- Add thumbnail_url column if it does not exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE projects
      ADD COLUMN thumbnail_url VARCHAR(500);
  END IF;

  -- Add progress column if it does not exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'progress'
  ) THEN
    ALTER TABLE projects
      ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;
