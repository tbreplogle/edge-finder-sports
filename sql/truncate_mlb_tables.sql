* ────────────────────────────────────────────────────────────────
   1.  Create the history table once (if it doesn’t exist)
       – structure = all columns from the view  +  snapshot_dts
   ────────────────────────────────────────────────────────────────*/
DO
$$
BEGIN
  IF NOT EXISTS (
        SELECT 1
        FROM   pg_class c
        JOIN   pg_namespace n ON n.oid = c.relnamespace
        WHERE  n.nspname = 'public'
          AND  c.relname = 'mlb_predictions_with_market_history'
  ) THEN
     EXECUTE $ctas$
        CREATE TABLE public.mlb_predictions_with_market_history AS
        SELECT
          now()::timestamptz   AS snapshot_dts,
          pm.*
        FROM public.mlb_predictions_with_market pm
        WHERE false;                 -- create structure only
     $ctas$;

     /* optional index to speed date look-ups */
     ALTER TABLE public.mlb_predictions_with_market_history
       ADD CONSTRAINT pk_mlb_pmw_hist PRIMARY KEY (snapshot_dts, matchup_id);

  END IF;
END;
$$ LANGUAGE plpgsql;

/* ────────────────────────────────────────────────────────────────
   2.  Append today’s snapshot (runs every morning *before* truncate)
   ────────────────────────────────────────────────────────────────*/
INSERT INTO public.mlb_predictions_with_market_history
SELECT
  now()::timestamptz      AS snapshot_dts,
  pm.*
FROM public.mlb_predictions_with_market pm;

/* ────────────────────────────────────────────────────────────────
   3.  Truncate your working tables (unchanged)
   ────────────────────────────────────────────────────────────────*/
TRUNCATE TABLE
    public.mlb_team_hitting_stats,
    public.mlb_predictions,
    public.mlb_matchups,
    public.mlb_market_odds,
    public.pitching_matchups;