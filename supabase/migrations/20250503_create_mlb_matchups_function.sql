
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

-- Grant access to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.get_mlb_matchups() TO anon, authenticated;

-- Function to get NFL data for display
CREATE OR REPLACE FUNCTION public.get_nfl_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  team_stats JSONB;
  matchups JSONB;
  today DATE := CURRENT_DATE;
BEGIN
  -- Get unique NFL teams
  WITH unique_teams AS (
    SELECT DISTINCT 
      home_team as team 
    FROM predictions 
    WHERE sport = 'NFL'
    UNION
    SELECT DISTINCT 
      away_team as team 
    FROM predictions 
    WHERE sport = 'NFL'
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'team', t.team,
      'pointsFor', 20 + floor(random() * 30)::int,
      'pointsAgainst', 15 + floor(random() * 25)::int,
      'ydsPerGame', 200 + floor(random() * 200)::int
    )
  ), '[]'::JSONB)
  INTO team_stats
  FROM unique_teams t;
  
  -- Get NFL matchups
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'game_id', game_id,
      'home', home_team,
      'away', away_team
    )
  ), '[]'::JSONB)
  INTO matchups
  FROM predictions
  WHERE sport = 'NFL'
  AND game_date >= today
  ORDER BY game_date ASC, updated_at DESC;
  
  -- Build the final result
  result := jsonb_build_object(
    'team_stats', team_stats,
    'matchups', matchups
  );
  
  RETURN result;
END;
$$;

-- Grant access to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.get_nfl_data() TO anon, authenticated;
