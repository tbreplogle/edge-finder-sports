-- sql/mlb_predictions.sql

-- 1) Ensure table exists
\i sql/create_mlb_predictions_table.sql

-- 2) Compute raw ratings per team,
--    joining 7‑day team hitting stats for today to get hs.home_runs & hs.avg
WITH ratings AS (
  SELECT
    pm.matchup_id,
    pm.team_id,
    GREATEST(
      0,
      LEAST(
        56.74
        +  0.108  * hs.home_runs    -- batters' HR over last 7 days
        -  0.0934 * pm.hr            -- pitchers' HR allowed
        + 334.9  * hs.avg           -- batters' BA over last 7 days
        +  0.188  * pm.era_plus
        -  61.98  * pm.whip,
        162
      )
    ) AS rating,
    pm.pitcher_role
  FROM pitching_matchups pm
  JOIN mlb_team_hitting_stats hs
    ON hs.matchup_id    = pm.matchup_id
   AND hs.team_id       = pm.team_id
   AND hs.timeframe_days = 7
   AND hs.game_date     = CURRENT_DATE
),

-- 3) Adjust for home/away
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

-- 4) Compute raw win probabilities
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
    ) AS raw_win_pct
  FROM adjusted a
  JOIN adjusted b
    ON a.matchup_id = b.matchup_id
   AND a.pitcher_role <> b.pitcher_role
),

-- 5) Cap win_pct at 0.88
capped_win AS (
  SELECT
    matchup_id,
    team_id,
    rating,
    adjusted_rating,
    LEAST(raw_win_pct, 0.88) AS win_pct
  FROM win_probs
),

-- 6) Translate to raw moneyline
final AS (
  SELECT
    c.matchup_id,
    c.team_id,
    c.rating,
    c.adjusted_rating,
    c.win_pct,
    CASE
      WHEN c.win_pct > 0.5
        THEN ROUND((1 / c.win_pct - 1) * -100)
      ELSE ROUND((1 / c.win_pct) * 100 - 100)
    END AS raw_moneyline
  FROM capped_win c
),

-- 7) Cap moneyline between -500 and 500
capped_money AS (
  SELECT
    matchup_id,
    team_id,
    rating,
    adjusted_rating,
    win_pct,
    GREATEST(LEAST(raw_moneyline, 500), -500) AS moneyline
  FROM final
)

-- 8) Upsert into your predictions table
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
FROM capped_money
ON CONFLICT (matchup_id, team_id)
DO UPDATE SET
  rating          = EXCLUDED.rating,
  adjusted_rating = EXCLUDED.adjusted_rating,
  win_pct         = EXCLUDED.win_pct,
  moneyline       = EXCLUDED.moneyline,
  created_at      = EXCLUDED.created_at;
