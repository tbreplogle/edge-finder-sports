/* 1️⃣  Snapshot the view */
INSERT INTO public.mlb_predictions_with_market_history
SELECT
    now() AS snapshot_dts,
    pm.*   -- every column from the view
FROM   public.mlb_predictions_with_market pm;

