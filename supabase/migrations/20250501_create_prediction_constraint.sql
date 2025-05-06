
-- Add unique constraint to predictions table to ensure sport+game_id combination is unique
ALTER TABLE predictions
  ADD CONSTRAINT IF NOT EXISTS uniq_pred UNIQUE (sport, game_id);

