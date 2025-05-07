-- sql/mlb_predictions.sql

-- 1) Ensure table exists
\i sql/create_mlb_predictions_table.sql

-- 2) Compute raw ratings per team (capped at 143),
--    joining in each team’s 7‑day hitting HR & BA for the exact game date
WITH ratings AS (
  SELECT
    pm.matchup_id,
    pm.team_id,
    LEAST(
      56.74
      +  0.108  * hs.home_runs    -- hitters’ HR over last 7 days
      -  0.0934 * pm.hr            -- pitchers’ HR allowed
      + 334.9  * hs.avg           -- hitters’ BA over last 7 days
      +  0.188  * pm.era_plus
      -  61.98  * pm.whip,
      143
    ) AS rating,
    pm.pitcher_role
  FROM pitching_matchups pm
  JOIN mlb_matchups m
    ON pm.matchup_id = m.matchup_id
  JOIN mlb_team_hitting_stats hs
    ON hs.team_id        = pm.team_id
   AND hs.game_date      = m.game_date
   AND hs.timeframe_days = 7
),

-- 3) Adjust ratings for home vs away
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

-- 4) Pair home & away to compute win_pct
win_probs AS (
  SELECT
    a.matchup_id,
    a.team_id,
    a.rating,
    a.adjusted_rating,
    b.adjusted_rating AS opp_adjusted_rating,
    (
      (a.adjusted_rating - a.adjusted_rating * b.adjusted_rating)
      / (a.adjusted_rating + b.adjusted_rating - 2 * a.adjusted_rating * b.adjusted_rating)
    ) AS win_pct
  FROM adjusted a
  JOIN adjusted b
    ON a.matchup_id = b.matchup_id
   AND a.pitcher_role <> b.pitcher_role
),

-- 5) Convert win_pct into moneyline (Excel formula) and cap to [-500,500]
final AS (
  SELECT
    w.matchup_id,
    w.team_id,
    w.rating,
    w.adjusted_rating,
    w.win_pct,
    LEAST(
      500,
      GREATEST(
        -500,
        CASE
          WHEN w.win_pct > 0.5
            THEN ROUND(-100 * w.win_pct / (1 - w.win_pct))
          ELSE ROUND(100 / w.win_pct - 100)
        END
      )
    ) AS moneyline
  FROM win_probs w
)

-- 6) Upsert into mlb_predictions
INSERT INTO mlb_predictions
  (matchup_id, team_id, rating, adjusted_rating, win_pct, moneyline, created_at)
SELECT
  matchup_id,
  team_id,
  rating,
  adjusted_rating,
  win_pct,
  moneyline,
  now()
FROM final
ON CONFLICT (matchup_id, team_id)
DO UPDATE SET
  rating          = EXCLUDED.rating,
  adjusted_rating = EXCLUDED.adjusted_rating,
  win_pct         = EXCLUDED.win_pct,
  moneyline       = EXCLUDED.moneyline,
  created_at      = EXCLUDED.created_at;
