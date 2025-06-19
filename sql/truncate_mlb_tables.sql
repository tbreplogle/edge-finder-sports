/* ────────────────────────────────────────────────────────────────
   1.  Append a daily snapshot of the view
       (adds 0 rows if the view happens to be empty)
   ────────────────────────────────────────────────────────────────*/
INSERT INTO public.mlb_predictions_with_market_history
SELECT
    now() AS snapshot_dts,      -- timestamp of the snapshot
    pm.*                        -- every column from the view
FROM   public.mlb_predictions_with_market pm;

