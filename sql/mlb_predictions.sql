-- ================================================================
--  sql/mlb_predictions.sql
--  Run from GitHub Action via:  psql -f sql/mlb_predictions.sql
-- ================================================================

/*----------------------------------------------------------------
  0) Ensure destination table & columns exist
----------------------------------------------------------------*/
CREATE TABLE IF NOT EXISTS public.mlb_predictions (
  matchup_id       TEXT    NOT NULL,
  team_id          INT     NOT NULL,
  game_date        DATE    NOT NULL,
  rating           NUMERIC,
  adjusted_rating  NUMERIC,
  win_pct          NUMERIC,
  moneyline        INT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (matchup_id, team_id)
);

-- add column if you already had an old table
ALTER TABLE public.mlb_predictions
  ADD COLUMN IF NOT EXISTS game_date DATE;

/*----------------------------------------------------------------
  1) Start clean: delete today’s rows
----------------------------------------------------------------*/
DELETE FROM public.mlb_predictions
WHERE game_date = CURRENT_DATE;

/*----------------------------------------------------------------
  2) Raw rating (capped at 143) + 14-day hitting adjust
     — only include matchups whose game_date = TODAY
----------------------------------------------------------------*/
WITH ratings AS (
  SELECT
    pm.matchup_id,
    pm.team_id,
    m.game_date,                    -- ← carry forward
    LEAST(
      56.74
      + 0.108  * hs.home_runs
      - 0.0934 * pm.hr
      + 334.9  * hs.avg
      + 0.188  * pm.era_plus
      - 61.98  * pm.whip,
      143
    )                               AS rating,
    pm.pitcher_role
  FROM   pitching_matchups pm
  JOIN   mlb_matchups m
         ON m.matchup_id = pm.matchup_id
        AND m.game_date  = CURRENT_DATE        -- ✨ today only
  JOIN   mlb_team_hitting_stats hs
         ON hs.team_id        = pm.team_id
        AND hs.game_date      = m.game_date
        AND hs.timeframe_days = 14
),

/*----------------------------------------------------------------
  3) Add home-field bonus
----------------------------------------------------------------*/
adj AS (
  SELECT
    r.matchup_id,
    r.team_id,
    r.game_date,
    r.rating,
    CASE WHEN r.pitcher_role = 'home'
         THEN r.rating + 6
         ELSE r.rating
    END                            AS adj_rating
  FROM ratings r
),

/*----------------------------------------------------------------
  4) Elo logistic → win%
----------------------------------------------------------------*/
prob AS (
  SELECT
    a.matchup_id,
    a.team_id,
    a.game_date,
    a.rating,
    a.adj_rating,
    GREATEST(
      0.12,
      LEAST(
        0.88,
        1 / (1 + POWER(10, (b.adj_rating - a.adj_rating) / 143))
      )
    )                              AS win_pct
  FROM adj a
  JOIN adj b
    ON b.matchup_id = a.matchup_id
   AND b.team_id    <> a.team_id
),

/*----------------------------------------------------------------
  5) Convert win% → moneyline
----------------------------------------------------------------*/
final AS (
  SELECT
    p.matchup_id,
    p.team_id,
    p.game_date,
    p.rating,
    p.adj_rating      AS adjusted_rating,
    p.win_pct,
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
    )                              AS moneyline
  FROM prob p
)

/*----------------------------------------------------------------
  6) UPSERT today’s predictions
----------------------------------------------------------------*/
INSERT INTO public.mlb_predictions
        (matchup_id,
         team_id,
         game_date,
         rating,
         adjusted_rating,
         win_pct,
         moneyline,
         created_at)
SELECT  matchup_id,
        team_id,
        game_date,
        rating,
        adjusted_rating,
        win_pct,
        moneyline,
        now()
FROM final
ON CONFLICT (matchup_id, team_id)
DO UPDATE
  SET rating          = EXCLUDED.rating,
      adjusted_rating = EXCLUDED.adjusted_rating,
      win_pct         = EXCLUDED.win_pct,
      moneyline       = EXCLUDED.moneyline,
      created_at      = EXCLUDED.created_at;
