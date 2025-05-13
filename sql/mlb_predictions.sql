-- ================================================================
--  sql/mlb_predictions.sql
--  RUN:  psql -f sql/mlb_predictions.sql
-- ------------------------------------------------
--  0‒143 rating  +7‑day hitting
--  +6‑point home bonus  (≈ +24 Elo)
--  Elo logistic  (denominator = 143)
--  Clamp prob 12‑88 %
--  Convert → American ML, clamp –500…+500
--  UPSERT → mlb_predictions
-- ================================================================

-- 0 ─ ensure dest table exists
\i sql/create_mlb_predictions_table.sql     -- ← your DDL path

-- 1 ─ raw rating (cap 143) + hitting
WITH ratings AS (
  SELECT
    pm.matchup_id,
    pm.team_id,
    LEAST(
      56.74
      +  0.108  * hs.home_runs      -- 7‑day HR
      -  0.0934 * pm.hr             -- HR allowed
      + 334.9  * hs.avg             -- 7‑day BA
      +  0.188  * pm.era_plus
      -  61.98  * pm.whip,
      143
    )              AS rating,
    pm.pitcher_role
  FROM pitching_matchups pm
  JOIN mlb_matchups m
        ON m.matchup_id = pm.matchup_id
  JOIN mlb_team_hitting_stats hs
        ON hs.team_id        = pm.team_id
       AND hs.game_date      = m.game_date
       AND hs.timeframe_days = 7
),

-- 2 ─ add fixed home‑field bump (+6)
adj AS (
  SELECT
    r.matchup_id,
    r.team_id,
    r.rating,
    CASE WHEN r.pitcher_role = 'home'
         THEN r.rating + 6
         ELSE r.rating
    END            AS adj_rating
  FROM ratings r
),

-- 3 ─ Elo logistic win%  (scale 143)  → clamp
prob AS (
  SELECT
    a.matchup_id,
    a.team_id,
    a.rating,
    a.adj_rating,
    GREATEST(
      0.12,
      LEAST(
        0.88,
        1.0 / (1.0 + POWER(10.0, (b.adj_rating - a.adj_rating) / 143.0))
      )
    ) AS win_pct
  FROM adj a
  JOIN adj b
    ON b.matchup_id = a.matchup_id
   AND b.team_id   <> a.team_id
),

-- 4 ─ prob → American ML, clamp ±500
final AS (
  SELECT
    p.matchup_id,
    p.team_id,
    p.rating,
    p.adj_rating      AS adjusted_rating,
    p.win_pct,
    LEAST(
      500,
      GREATEST(
        -500,
        CASE
          WHEN p.win_pct >= 0.5
            THEN -ROUND(100 *  p.win_pct        / (1 - p.win_pct))
          ELSE  ROUND(100 * (1 - p.win_pct) /  p.win_pct)
        END
      )
    )                AS moneyline
  FROM prob p
)

-- 5 ─ UPSERT
INSERT INTO mlb_predictions
        (matchup_id,
         team_id,
         rating,
         adjusted_rating,
         win_pct,
         moneyline,
         created_at)
SELECT  matchup_id,
        team_id,
        rating,
        adjusted_rating,
        win_pct,
        moneyline,
        NOW()
FROM final
ON CONFLICT (matchup_id, team_id)
DO UPDATE
  SET rating          = EXCLUDED.rating,
      adjusted_rating = EXCLUDED.adjusted_rating,
      win_pct         = EXCLUDED.win_pct,
      moneyline       = EXCLUDED.moneyline,
      created_at      = EXCLUDED.created_at;
