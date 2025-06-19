/* 1. Create history table if it doesn’t exist (structure only) */
CREATE TABLE IF NOT EXISTS public.mlb_predictions_with_market_history
LIKE public.mlb_predictions_with_market                          -- copy ALL cols
INCLUDING ALL;                                                   -- defaults, indexes, etc.

/* 1-b.  Add snapshot column the first time this runs */
DO
$$
BEGIN
  IF NOT EXISTS (
        SELECT 1
        FROM   information_schema.columns
        WHERE  table_schema = 'public'
          AND  table_name   = 'mlb_predictions_with_market_history'
          AND  column_name  = 'snapshot_dts'
  ) THEN
     ALTER TABLE public.mlb_predictions_with_market_history
       ADD COLUMN snapshot_dts timestamptz NOT NULL;
     /* optional composite primary key */
     ALTER TABLE public.mlb_predictions_with_market_history
       ADD PRIMARY KEY (snapshot_dts, matchup_id);
  END IF;
END;
$$ LANGUAGE plpgsql;

/* 2. Append the current view rows with time-stamp */
INSERT INTO public.mlb_predictions_with_market_history
        (snapshot_dts,            -- first column
         SELECT * FROM public.mlb_predictions_with_market LIMIT 0)  -- column list
SELECT
  now() AS snapshot_dts,
  pm.*
FROM public.mlb_predictions_with_market AS pm;

/* 3. Truncate live tables for today’s fresh load */
TRUNCATE TABLE
    public.mlb_team_hitting_stats,
    public.mlb_predictions,
    public.mlb_matchups,
    public.mlb_market_odds,
    public.pitching_matchups;
