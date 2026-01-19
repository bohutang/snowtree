-- Add repo info cache fields to sessions table
ALTER TABLE sessions ADD COLUMN current_branch TEXT;
ALTER TABLE sessions ADD COLUMN owner_repo TEXT;
ALTER TABLE sessions ADD COLUMN is_fork BOOLEAN DEFAULT 0;
ALTER TABLE sessions ADD COLUMN origin_owner_repo TEXT;
