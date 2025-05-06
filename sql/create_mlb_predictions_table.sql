
-- Create the MLB predictions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.mlb_predictions (
  matchup_id TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  rating NUMERIC NOT NULL,
  adjusted_rating NUMERIC NOT NULL,
  win_pct NUMERIC NOT NULL,
  moneyline INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (matchup_id, team_id),
  FOREIGN KEY (matchup_id) REFERENCES public.mlb_matchups(matchup_id),
  FOREIGN KEY (team_id) REFERENCES public.teams_mlb(team_id)
);

-- Add comment to the table
COMMENT ON TABLE public.mlb_predictions IS 'Generated MLB predictions with win probabilities and moneylines';
