
-- sql/mlb_predictions.sql

BEGIN;

-- 1) Create the predictions table if it doesn't exist
CREATE TABLE IF NOT EXISTS mlb_predictions (
  matchup_id      TEXT        PRIMARY KEY
    REFERENCES mlb_matchups(matchup_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  home_win_pct    NUMERIC,
  away_win_pct    NUMERIC,
  home_moneyline  INTEGER,
  away_moneyline  INTEGER,
  run_date        DATE        NOT NULL DEFAULT CURRENT_DATE
);

-- 2) Compute raw ratings for each side
WITH computed AS (
  SELECT
    m.matchup_id,
    -- home rating
    (56.74
      + 0.108 * h_home.home_runs
      - 0.0934 * p_away.hr
      + 334.9 * h_home.avg
      + 0.188 * p_home.era_plus
      - 61.98 * p_home.whip
    ) AS home_rating,
    -- away rating
    (56.74
      + 0.108 * h_away.home_runs
      - 0.0934 * p_home.hr
      + 334.9 * h_away.avg
      + 0.188 * p_away.era_plus
      - 61.98 * p_away.whip
    ) AS away_rating
  FROM mlb_matchups m
  JOIN mlb_team_hitting_stats   h_home ON h_home.team_id  = m.home_team_id
                                      AND h_home.game_date = CURRENT_DATE
                                      AND h_home.timeframe_days = 7
  JOIN mlb_team_hitting_stats   h_away ON h_away.team_id  = m.away_team_id
                                      AND h_away.game_date = CURRENT_DATE
                                      AND h_away.timeframe_days = 7
  JOIN pitching_matchups        p_home ON p_home.matchup_id = m.matchup_id
                                      AND p_home.pitcher_role = 'home'
  JOIN pitching_matchups        p_away ON p_away.matchup_id = m.matchup_id
                                      AND p_away.pitcher_role = 'away'
),
-- 3) Apply the "adjustment" step
adjusted AS (
  SELECT
    matchup_id,
    ((home_rating/162) * (15-1) + 0.5) / 15 * 1.02   AS home_adj,
    ((away_rating/162) * (15-1) + 0.5) / 15 * 0.98   AS away_adj
  FROM computed
),
-- 4) Convert adj ratings into win percentages & moneylines
probs AS (
  SELECT
    matchup_id,
    (home_adj - home_adj * away_adj) /
      (home_adj + away_adj - 2 * home_adj * away_adj) AS home_win_pct,
    (away_adj - away_adj * home_adj) /
      (away_adj + home_adj - 2 * away_adj * home_adj) AS away_win_pct,
    CASE
      WHEN (home_win_pct > 0.5)
      THEN ROUND(100 / ((1/home_win_pct) - 1) * -1)
      ELSE ROUND((1/home_win_pct) * 100 - 100)
    END AS home_moneyline,
    CASE
      WHEN (away_win_pct > 0.5)
      THEN ROUND(100 / ((1/away_win_pct) - 1) * -1)
      ELSE ROUND((1/away_win_pct) * 100 - 100)
    END AS away_moneyline
  FROM adjusted
)

-- 5) Upsert into your predictions table
INSERT INTO mlb_predictions
  (matchup_id, home_win_pct, away_win_pct, home_moneyline, away_moneyline, run_date)
SELECT
  matchup_id, home_win_pct, away_win_pct, home_moneyline, away_moneyline, CURRENT_DATE
FROM probs
ON CONFLICT (matchup_id) DO UPDATE
  SET home_win_pct   = EXCLUDED.home_win_pct,
      away_win_pct   = EXCLUDED.away_win_pct,
      home_moneyline = EXCLUDED.home_moneyline,
      away_moneyline = EXCLUDED.away_moneyline,
      run_date       = EXCLUDED.run_date;

COMMIT;
