-- sql/mlb_predictions.sql

-- 1) Ensure table exists
\i sql/create_mlb_predictions_table.sql

-- 2) Compute raw ratings per team
WITH ratings AS (
  SELECT
    pm.matchup_id,
    pm.team_id,
    -- rating formula:
    56.74
    +  0.108 * pm.hr               -- HR
    -  0.0934 * pm.hr              -- HRA (using same hr column)
    + 334.9   * pm.ba              -- BA
    +  0.188  * pm.era_plus        -- ERA+
    -  61.98  * pm.whip            -- WHIP
      AS rating,
    pm.pitcher_role
  FROM pitching_matchups pm
),

-- 3) Adjust ratings for home/away
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

-- 4) Compute win probabilities by pairing home vs away
win_probs AS (
  SELECT
    a.matchup_id,
    a.team_id,
    a.rating,
    a.adjusted_rating,
    -- find the opposite team in this matchup
    b.adjusted_rating AS opp_adjusted_rating,
    -- same formula for both roles:
    ( (a.adjusted_rating - a.adjusted_rating * b.adjusted_rating)
      / (a.adjusted_rating + b.adjusted_rating - 2 * a.adjusted_rating * b.adjusted_rating)
    ) AS win_pct
  FROM adjusted a
  JOIN adjusted b
    ON a.matchup_id = b.matchup_id
   AND a.pitcher_role <> b.pitcher_role
),

-- 5) Translate win_pct to moneyline
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

-- 6) Upsert into mlb_predictions
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
