-- ================================================================
--  sql/mlb_predictions.sql
--  Run from GitHub Action via:  psql -f sql/mlb_predictions.sql
-- ================================================================

/* ----------------------------------------------------------------
   0) Ensure destination table exists (NO data change)
-----------------------------------------------------------------*/
create table if not exists public.mlb_predictions (
  matchup_id        text    not null,
  team_id           int     not null,
  rating            numeric,
  adjusted_rating   numeric,
  win_pct           numeric,
  moneyline         int,
  created_at        timestamptz default now(),
  primary key (matchup_id, team_id)
);

/* ----------------------------------------------------------------
   1) Raw rating (capped at 143) + 7-day hitting adjust
-----------------------------------------------------------------*/
with ratings as (
  select
    pm.matchup_id,
    pm.team_id,
    least(
      56.74
      + 0.108  * hs.home_runs
      - 0.0934 * pm.hr
      + 334.9  * hs.avg
      + 0.188  * pm.era_plus
      - 61.98  * pm.whip,
      143
    )                             as rating,
    pm.pitcher_role
  from   pitching_matchups pm
  join   mlb_matchups      m  on m.matchup_id = pm.matchup_id
  join   mlb_team_hitting_stats hs
         on hs.team_id        = pm.team_id
        and hs.game_date      = m.game_date
        and hs.timeframe_days = 7
),

/* ----------------------------------------------------------------
   2) Add home-field bonus (+6)
-----------------------------------------------------------------*/
adj as (
  select
    r.matchup_id,
    r.team_id,
    r.rating,
    case when r.pitcher_role = 'home'
         then r.rating + 6
         else r.rating
    end                         as adj_rating
  from ratings r
),

/* ----------------------------------------------------------------
   3) Elo logistic → win% (clamp 12-88 %)
-----------------------------------------------------------------*/
prob as (
  select
    a.matchup_id,
    a.team_id,
    a.rating,
    a.adj_rating,
    greatest(
      0.12,
      least(
        0.88,
        1 / (1 + power(10, (b.adj_rating - a.adj_rating) / 143))
      )
    )                           as win_pct
  from adj a
  join adj b
    on b.matchup_id = a.matchup_id
   and b.team_id    <> a.team_id
),

/* ----------------------------------------------------------------
   4) Convert win% → moneyline (clamp –500…+500)
-----------------------------------------------------------------*/
final as (
  select
    p.matchup_id,
    p.team_id,
    p.rating,
    p.adj_rating      as adjusted_rating,
    p.win_pct,
    least(
      500,
      greatest(
        -500,
        case
          when p.win_pct >= 0.5
            then -round(100 * p.win_pct / (1 - p.win_pct))
          else  round(100 * (1 - p.win_pct) / p.win_pct)
        end
      )
    )                           as moneyline
  from prob p
)

/* ----------------------------------------------------------------
   5) UPSERT into mlb_predictions
-----------------------------------------------------------------*/
insert into mlb_predictions
        (matchup_id,
         team_id,
         rating,
         adjusted_rating,
         win_pct,
         moneyline,
         created_at)
select  matchup_id,
        team_id,
        rating,
        adjusted_rating,
        win_pct,
        moneyline,
        now()
from final
on conflict (matchup_id, team_id)
do update
  set rating          = excluded.rating,
      adjusted_rating = excluded.adjusted_rating,
      win_pct         = excluded.win_pct,
      moneyline       = excluded.moneyline,
      created_at      = excluded.created_at;
