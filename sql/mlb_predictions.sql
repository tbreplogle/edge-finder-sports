-- ================================================================
--  sql/mlb_predictions.sql               (fixed 2025-06-16)
--  Run from GitHub Action via:  psql -f sql/mlb_predictions.sql
-- ================================================================

/*----------------------------------------------------------------
  0) Ensure destination table & columns exist
----------------------------------------------------------------*/
CREATE TABLE IF NOT EXISTS public.mlb_predictions (
  matchup_id       TEXT    NOT NULL,
  team_id          INT     NOT NULL,
  game_date        DATE    NOT NULL,          -- 🆕 actual game day
  rating           NUMERIC,
  adjusted_rating  NUMERIC,
  win_pct          NUMERIC,
  moneyline        INT,
  pred_total       NUMERIC,
  created_at       TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (matchup_id, team_id)
);

-- add columns that might be missing on an older table
ALTER TABLE public.mlb_predictions
  ADD COLUMN IF NOT EXISTS game_date   DATE,
  ADD COLUMN IF NOT EXISTS pred_total  NUMERIC;

/*----------------------------------------------------------------
  1) Raw rating (capped at 143) + 14-day hitting adjust
----------------------------------------------------------------*/
WITH ratings AS (
  SELECT
    pm.matchup_id,
    pm.team_id,
    LEAST(
      56.74
      + 0.108  * hs.home_runs
      - 0.0934 * pm.hr
      + 334.9  * hs.avg
      + 0.188  * pm.era_plus
      - 61.98  * pm.whip,
      143
    ) AS rating,
    pm.pitcher_role
  FROM   pitching_matchups pm
  JOIN   mlb_matchups      m  ON m.matchup_id = pm.matchup_id
  JOIN   mlb_team_hitting_stats hs
         ON hs.team_id        = pm.team_id
        AND hs.timeframe_days = 14
),

/*----------------------------------------------------------------
  2) Add home-field bonus (+6)
----------------------------------------------------------------*/
adj AS (
  SELECT
    r.matchup_id,
    r.team_id,
    r.rating,
    CASE WHEN r.pitcher_role = 'home' THEN r.rating + 6 ELSE r.rating END
      AS adj_rating
  FROM ratings r
),

/*----------------------------------------------------------------
  3) Elo logistic → win %
----------------------------------------------------------------*/
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
        1 / (1 + POWER(10, (b.adj_rating - a.adj_rating) / 143))
      )
    ) AS win_pct
  FROM adj a
  JOIN adj b
    ON b.matchup_id = a.matchup_id
   AND b.team_id    <> a.team_id
),

/*----------------------------------------------------------------
  4) Helper CTEs for TOTAL-runs prediction
----------------------------------------------------------------*/
last14 AS (
  SELECT
    team_id,
    ops AS ops_14
  FROM mlb_team_hitting_stats
  WHERE timeframe_days = 14
),
sp AS (
  SELECT
    pm.matchup_id,
    pm.pitcher_role,
    pm.era
  FROM   pitching_matchups pm
  JOIN   mlb_matchups m ON m.matchup_id = pm.matchup_id
),
totals AS (
  SELECT
    mu.matchup_id,
    ROUND(
        -12.6
      + 11.5 * lh.ops_14
      + 11.5 * la.ops_14
      +  0.65 * COALESCE(sp_home.era , 4.00)
      +  0.65 * COALESCE(sp_away.era , 4.00)
    , 1) AS pred_total
  FROM   mlb_matchups mu
  LEFT JOIN last14    lh ON lh.team_id = mu.home_team_id
  LEFT JOIN last14    la ON la.team_id = mu.away_team_id
  LEFT JOIN sp sp_home ON sp_home.matchup_id = mu.matchup_id
                      AND sp_home.pitcher_role = 'home'
  LEFT JOIN sp sp_away ON sp_away.matchup_id = mu.matchup_id
                      AND sp_away.pitcher_role = 'away'
),

/*----------------------------------------------------------------
  5) Convert win % → moneyline + attach pred_total + game_date
----------------------------------------------------------------*/
final AS (
  SELECT
    p.matchup_id,
    p.team_id,
    p.rating,
    p.adj_rating                    AS adjusted_rating,
    p.win_pct,
    /* moneyline clamp */
    LEAST(
      500,
      GREATEST(
        -500,
        CASE
          WHEN p.win_pct >= 0.5
            THEN -ROUND(100 *  p.win_pct          / (1 - p.win_pct))
          ELSE  ROUND(100 * (1 - p.win_pct) /  p.win_pct)
        END
      )
    ) AS moneyline,
    t.pred_total,
    mu.game_time_ct::date           AS game_date          -- 🆕
  FROM prob p
  JOIN totals      t   ON t.matchup_id = p.matchup_id
  JOIN mlb_matchups mu ON mu.matchup_id = p.matchup_id
)

/*----------------------------------------------------------------
  6) UPSERT today’s predictions
----------------------------------------------------------------*/
INSERT INTO public.mlb_predictions (
  matchup_id,
  team_id,
  game_date,         -- 🆕
  rating,
  adjusted_rating,
  win_pct,
  moneyline,
  pred_total,
  created_at
)
SELECT
  matchup_id,
  team_id,
  game_date,         -- 🆕
  rating,
  adjusted_rating,
  win_pct,
  moneyline,
  pred_total,
  now()
FROM final
ON CONFLICT (matchup_id, team_id) DO UPDATE
SET rating          = EXCLUDED.rating,
    adjusted_rating = EXCLUDED.adjusted_rating,
    win_pct         = EXCLUDED.win_pct,
    moneyline       = EXCLUDED.moneyline,
    pred_total      = EXCLUDED.pred_total,
    game_date       = EXCLUDED.game_date,     -- 🆕
    created_at      = EXCLUDED.created_at;
