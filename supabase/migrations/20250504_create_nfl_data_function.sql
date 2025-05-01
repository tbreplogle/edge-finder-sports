
-- Function to get NFL data (similar to MLB data function)
CREATE OR REPLACE FUNCTION public.get_nfl_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
  team_stats JSONB;
  matchups JSONB;
BEGIN
  -- Get NFL teams from predictions table
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
  SELECT jsonb_object_agg(
    t.team,
    jsonb_build_object(
      'team', t.team,
      'pointsFor', 20 + floor(random() * 15)::int, -- Placeholder data
      'pointsAgainst', 15 + floor(random() * 20)::int, -- Placeholder data
      'ydsPerGame', 300 + floor(random() * 150)::int -- Placeholder data
    )
  )
  INTO team_stats
  FROM unique_teams t;
  
  -- Get NFL matchups
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'game_id', p.game_id,
      'away', p.away_team,
      'home', p.home_team
    )
  ), '[]'::JSONB)
  INTO matchups
  FROM predictions p
  WHERE p.sport = 'NFL'
  GROUP BY p.game_id, p.home_team, p.away_team
  LIMIT 10;
  
  -- Build the response object
  result := jsonb_build_object(
    'team_stats', COALESCE(team_stats, '{}'::jsonb),
    'matchups', COALESCE(matchups, '[]'::jsonb)
  );
  
  RETURN result;
END;
$function$;

-- Function to get MLB matchups
CREATE OR REPLACE FUNCTION public.get_mlb_matchups()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
BEGIN
  -- Get matchups from the MLB matchups table
  -- This is a simplified example that will return some data
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'game_id', m.game_id,
      'home', m.home_team,
      'away', m.away_team,
      'moneyline', floor(random() * 200)::int - 100,
      'moneyline_opponent', floor(random() * 200)::int - 100,
      'pitcher_home', jsonb_build_object(
        'game_id', m.game_id, 
        'team', m.home_team,
        'ERAplus', 100 + floor(random() * 50)::int,
        'WHIP', (1.0 + random() * 0.5)::numeric(3,2)
      ),
      'pitcher_away', jsonb_build_object(
        'game_id', m.game_id, 
        'team', m.away_team,
        'ERAplus', 100 + floor(random() * 50)::int,
        'WHIP', (1.0 + random() * 0.5)::numeric(3,2)
      )
    )
  ), '[]'::JSONB)
  INTO result
  FROM mlb_matchups m
  LIMIT 10;
  
  -- If no data was found in the table, create some sample data
  IF result IS NULL OR result = '[]'::jsonb THEN
    WITH sample_matchups AS (
      SELECT 
        p.game_id,
        p.home_team,
        p.away_team
      FROM predictions p
      WHERE p.sport = 'MLB'
      LIMIT 5
    )
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'game_id', m.game_id,
        'home', m.home_team,
        'away', m.away_team,
        'moneyline', floor(random() * 200)::int - 100,
        'moneyline_opponent', floor(random() * 200)::int - 100
      )
    ), '[]'::JSONB)
    INTO result
    FROM sample_matchups m;
  END IF;
  
  RETURN result;
END;
$function$;
