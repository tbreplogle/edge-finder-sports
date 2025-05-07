-- sql/mlb_predictions.sql

-- 1) Ensure the predictions table exists
\i sql/create_mlb_predictions_table.sql

-- 2) Build your CTE pipeline in one WITH, but only using today’s rows
WITH

  -- a) Today’s latest 7‑day hitting averages
  latest_hitting AS (
    SELECT
      team_id,
      avg AS ba
    FROM mlb_team_hitting_stats
    WHERE timeframe_days = 7
      AND created_at::date = current_date
  ),

  -- b) Only today’s pitching_matchups, joined to today’s BA
  ratings AS (
    SELECT
      pm.matchup_id,
      pm.team_id,
      56.74
        +  0.108  * pm.hr
        -  0.0934 * pm.hr
        + 334.9   * lh.ba
        +  0.188  * pm.era_plus
        -  61.98  * pm.whip
        AS rating,
      pm.pitcher_role
    FROM pitching_matchups pm
    JOIN latest_hitting lh USING (team_id)
    WHERE pm.created_at::date = current_date
  ),

  -- c) Adjust for home/away
  adjusted AS (
    SELECT
      r.*,
      CASE
        WHEN r.pitcher_role = 'home'
          THEN ((r.rating/162)*(15-1)+0.5)/15 * 1.02
        ELSE ((r.rating/162)*(15-1)+0.5)/15 * 0.98
      END AS adjusted_rating
    FROM ratings r
  ),

  -- d) Pair them up for win‑probs
  win_probs AS (
    SELECT
      a.matchup_id,
      a.team_id,
      a.rating,
      a.adjusted_rating,
      b.adjusted_rating AS opp_adjusted_rating,
      (
        (a.adjusted_rating - a.adjusted_rating * b.adjusted_rating)
        / (a.adjusted_rating + b.adjusted_rating
           - 2 * a.adjusted_rating * b.adjusted_rating)
      ) AS win_pct
    FROM adjusted a
    JOIN adjusted b
      ON a.matchup_id = b.matchup_id
     AND a.pitcher_role <> b.pitcher_role
  ),

  -- e) Convert to moneyline
  final AS (
    SELECT
      w.matchup_id,
      w.team_id,
      w.rating,
      w.adjusted_rating,
      w.win_pct,
      CASE
        WHEN w.win_pct > 0.5
          THEN ROUND((1 / w.win_pct - 1) * -100)
        ELSE ROUND((1 / w.win_pct) * 100 - 100)
      END AS moneyline
    FROM win_probs w
  )

-- 3) Upsert today’s predictions
INSERT INTO mlb_predictions
  (matchup_id, team_id, rating, adjusted_rating, win_pct, moneyline)
SELECT
  matchup_id,
  team_id,
  rating,
  adjusted_rating,
  win_pct,
  moneyline
FROM final
ON CONFLICT (matchup_id, team_id)
DO UPDATE
  SET rating          = EXCLUDED.rating,
      adjusted_rating = EXCLUDED.adjusted_rating,
      win_pct         = EXCLUDED.win_pct,
      moneyline       = EXCLUDED.moneyline,
      created_at      = now();
