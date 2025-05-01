
-- Function to retrieve MLB team stats
CREATE OR REPLACE FUNCTION public.get_mlb_team_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Get team stats from the actual data in predictions table
  -- This is a simplified example that creates a list of unique teams with some stats
  WITH unique_teams AS (
    SELECT DISTINCT 
      home_team as team 
    FROM predictions 
    WHERE sport = 'MLB'
    UNION
    SELECT DISTINCT 
      away_team as team 
    FROM predictions 
    WHERE sport = 'MLB'
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'team', t.team,
      'hr', 20 + floor(random() * 30), -- Placeholder data
      'hra', 15 + floor(random() * 25), -- Placeholder data
      'ba', (0.220 + (random() * 0.080))::numeric(4,3) -- Placeholder data
    )
  ), '[]'::JSONB)
  INTO result
  FROM unique_teams t;
  
  RETURN result;
END;
$$;

-- Function to retrieve MLB matchups
CREATE OR REPLACE FUNCTION public.get_mlb_matchups()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  today DATE := CURRENT_DATE;
BEGIN
  -- Get matchups from predictions table for today's games
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'game_id', game_id,
      'home', home_team,
      'away', away_team,
      'moneyline', market_home_ml,
      'moneyline_opponent', market_away_ml
    )
  ), '[]'::JSONB)
  INTO result
  FROM predictions
  WHERE sport = 'MLB'
  AND game_date >= today
  ORDER BY game_date ASC, updated_at DESC;
  
  RETURN result;
END;
$$;

-- Function to get MLB prediction data for display
CREATE OR REPLACE FUNCTION public.get_mlb_prediction_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  today DATE := CURRENT_DATE;
BEGIN
  -- Get all MLB prediction data needed for the dashboard
  WITH predictions_data AS (
    SELECT 
      *
    FROM predictions
    WHERE sport = 'MLB'
    AND game_date >= today
    ORDER BY game_date ASC, updated_at DESC
  )
  SELECT jsonb_build_object(
    'predictions', COALESCE(jsonb_agg(p.*), '[]'::JSONB)
  ) INTO result
  FROM predictions_data p;
  
  RETURN result;
END;
$$;

-- Grant access to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.get_mlb_team_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_mlb_matchups() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_mlb_prediction_data() TO anon, authenticated;
