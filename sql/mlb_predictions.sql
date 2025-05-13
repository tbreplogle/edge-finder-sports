-- ============================================
--  mlb_predictions.sql   (run with psql -f …)
-- --------------------------------------------
--  • raw rating (0‑143) from pitching + 7‑day hitting
--  • home/away adjustment
--  • Elo‑style win‑probability
--  • clamp to 12 %‑88 %
--  • convert to American money‑line
--  • UPSERT into mlb_predictions
-- ============================================

-- 0) make sure the table exists
\i sql/create_mlb_predictions_table.sql     -- ← path to your DDL

-- -------------------------------------------------------------------
-- 1) raw rating, joined with SAME‑DATE 7‑day team‑hitting stats
-- -------------------------------------------------------------------
WITH ratings AS (
  SELECT
    pm.matchup_id,
    pm.team_id,
    LEAST(
      56.74
      +  0.108  * hs.home_runs          -- last‑7‑day team HR
      -  0.0934 * pm.hr                 -- pitcher HR allowed
      + 334.9  * hs.avg                 -- last‑7‑day BA
      +  0.188  * pm.era_plus
      -  61.98  * pm.whip,
      143                                -- hard cap
    )                        AS rating,
    pm.pitcher_role
  FROM pitching_matchups pm
  JOIN mlb_matchups m
        ON m.matchup_id = pm.matchup_id
  JOIN mlb_team_hitting_stats hs
        ON hs.team_id        = pm.team_id
       AND hs.game_date      = m.game_date
       AND hs.timeframe_days = 7
),

-- -------------------------------------------------------------------
-- 2) home / away adjustment (same scaling you used before)
-- -------------------------------------------------------------------
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

-- -------------------------------------------------------------------
-- 3) pair home vs away → Elo logistic win%  (clamped 0.12‑0.88)
-- -------------------------------------------------------------------
win_probs AS (
  SELECT
    a.matchup_id,
    a.team_id,
    a.rating,
    a.adjusted_rating,
    b.adjusted_rating                    AS opp_adjusted_rating,
    /* ----------------------------------------------
       Elo logistic:   1 / ( 1 + 10^((RB‑RA)/S) )
       S = 400 by default
       ---------------------------------------------- */
    GREATEST(
      0.12,                              -- lower bound
      LEAST(
        0.88,                            -- upper bound
        1.0 / (1.0 + POWER(10.0, (b.adjusted_rating - a.adjusted_rating)/70.0))
      )
    )                                   AS win_pct
  FROM adjusted a
  JOIN adjusted b
    ON b.matchup_id   = a.matchup_id
   AND b.pitcher_role <> a.pitcher_role
),

-- -------------------------------------------------------------------
-- 4) convert win% → American odds (probToMoneyline)
-- -------------------------------------------------------------------
final AS (
  SELECT
    w.matchup_id,
    w.team_id,
    w.rating,
    w.adjusted_rating,
    w.win_pct,
    CASE
      WHEN w.win_pct >= 0.5
        /* favourite: negative price */
        THEN -ROUND( (w.win_pct / (1 - w.win_pct)) * 100 )
      ELSE
        /* under‑dog: positive price */
        ROUND( ((1 - w.win_pct) / w.win_pct) * 100 )
    END                             AS moneyline
  FROM win_probs w
)

-- -------------------------------------------------------------------
-- 5) UPSERT
-- -------------------------------------------------------------------
INSERT INTO mlb_predictions
  (matchup_id,
   team_id,
   rating,
   adjusted_rating,
   win_pct,
   moneyline,
   created_at)
SELECT
  matchup_id,
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
