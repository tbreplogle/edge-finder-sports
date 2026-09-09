import json, math, time, random
from collections import defaultdict
import sos_feature_adjust_backtest as m

FIELDS=['ppo','success','explosiveness','lineYards','fieldPosition']
RIDGES=[0.0,1.0,3.0,5.0,8.0]
SCALES=m.SCALES


def derive_drive_game_metrics(drives):
    # Per team-game PPO and average starting field position. CFBD's season field-position
    # value is in yards-to-goal units (~70), so startYardsToGoal is the matching scale.
    b={}
    for d in drives:
        gid=str(d.get('gameId') or '')
        team=m.canon(d.get('offense')); opp=m.canon(d.get('defense'))
        if not gid or not team or not opp: continue
        k=(gid,team)
        x=b.setdefault(k,{'opponent':opp,'drive_starts':[],'opp_points':0.0,'opportunities':0})
        sy=d.get('startYardsToGoal'); ey=d.get('endYardsToGoal')
        if m.finite(sy): x['drive_starts'].append(float(sy))
        # Approximate the standard scoring-opportunity definition: drive reaches opponent 40.
        # Drive endpoint plus start point capture nearly all such drives; validation versus the
        # season aggregate is reported below rather than silently assuming exact reconstruction.
        reached40=(m.finite(sy) and float(sy)<=40) or (m.finite(ey) and float(ey)<=40)
        if reached40:
            x['opportunities']+=1
            a=d.get('startOffenseScore'); z=d.get('endOffenseScore')
            pts=max(0.0,float(z)-float(a)) if m.finite(a) and m.finite(z) else 0.0
            x['opp_points']+=pts
    out={}
    for k,x in b.items():
        out[k]={'opponent':x['opponent'],
                'ppo':x['opp_points']/x['opportunities'] if x['opportunities'] else math.nan,
                'ppo_weight':max(1,x['opportunities']),
                'fieldPosition':sum(x['drive_starts'])/len(x['drive_starts']) if x['drive_starts'] else math.nan,
                'fieldPosition_weight':max(1,len(x['drive_starts']))}
    return out


def build_team_game_rows(game_adv,drive_metrics,gby,asof):
    rows=[]
    for r in game_adv:
        wk=int(r.get('week') or 0)
        if wk<=0 or wk>asof: continue
        gid=str(r.get('gameId') or '')
        g=gby.get(gid)
        if not g or not g.get('completed'): continue
        hc=str(g.get('homeClassification') or g.get('homeDivision') or '').lower()
        ac=str(g.get('awayClassification') or g.get('awayDivision') or '').lower()
        if hc!='fbs' or ac!='fbs': continue
        team=m.canon(r.get('team')); opp=m.canon(r.get('opponent'))
        if not team or not opp: continue
        off=r.get('offense') or {}; dm=drive_metrics.get((gid,team),{})
        plays=float(off.get('plays')) if m.finite(off.get('plays')) else math.nan
        vals={
          'ppo':dm.get('ppo',math.nan),
          'success':float(off.get('successRate')) if m.finite(off.get('successRate')) else math.nan,
          'explosiveness':float(off.get('explosiveness')) if m.finite(off.get('explosiveness')) else math.nan,
          'lineYards':float(off.get('lineYardsTotal'))/plays if m.finite(off.get('lineYardsTotal')) and m.finite(plays) and plays>0 else math.nan,
          'fieldPosition':dm.get('fieldPosition',math.nan),
        }
        weights={
          'ppo':float(dm.get('ppo_weight',1))/4.0,
          'fieldPosition':float(dm.get('fieldPosition_weight',1))/12.0,
          'success':min(120,max(20,plays))/60.0 if m.finite(plays) and plays>0 else 1.0,
          'explosiveness':min(120,max(20,plays))/60.0 if m.finite(plays) and plays>0 else 1.0,
          'lineYards':min(120,max(20,plays))/60.0 if m.finite(plays) and plays>0 else 1.0,
        }
        if all(m.finite(vals[f]) for f in FIELDS): rows.append({'team':team,'opponent':opp,'week':wk,'game_id':gid,'values':vals,'weights':weights})
    return rows


def two_way(rows,field,ridge):
    obs=[r for r in rows if m.finite(r['values'][field])]
    teams=sorted(set([r['team'] for r in obs]+[r['opponent'] for r in obs]))
    if not obs or not teams:return None
    def wt(r): return max(.05,float(r['weights'].get(field,1)))
    den=sum(wt(r) for r in obs); mean=sum(wt(r)*float(r['values'][field]) for r in obs)/den
    off={t:0. for t in teams}; allow={t:0. for t in teams}
    def center(d):
        z=sum(d[t] for t in teams)/len(teams)
        for t in teams:d[t]-=z
    for _ in range(25):
        ss=defaultdict(float);ww=defaultdict(float)
        for r in obs:
            w=wt(r);ss[r['team']]+=w*(r['values'][field]-mean-allow.get(r['opponent'],0));ww[r['team']]+=w
        for t in teams:off[t]=ss[t]/(ww[t]+ridge) if ww[t]+ridge else 0
        center(off)
        ss=defaultdict(float);ww=defaultdict(float)
        for r in obs:
            w=wt(r);ss[r['opponent']]+=w*(r['values'][field]-mean-off.get(r['team'],0));ww[r['opponent']]+=w
        for t in teams:allow[t]=ss[t]/(ww[t]+ridge) if ww[t]+ridge else 0
        center(allow)
    return {'off':off,'allow':allow,'mean':mean}


def adjusted_rating_index(rows,ridge):
    fits={f:two_way(rows,f,ridge) for f in FIELDS}
    if any(v is None for v in fits.values()):return {}
    teams=set.intersection(*[set(v['off'])&set(v['allow']) for v in fits.values()])
    out={}
    for t in teams:
        d={f:fits[f]['off'].get(t,0)-fits[f]['allow'].get(t,0) for f in FIELDS}
        out[t]=1.5*(2.5*d['ppo']+60*d['success']+25*d['explosiveness']+5*min(max(d['lineYards'],-.4),.5)+.1*d['fieldPosition'])
    return out


def corr(xs,ys):
    pairs=[(float(x),float(y)) for x,y in zip(xs,ys) if m.finite(x) and m.finite(y)]
    if len(pairs)<3:return None
    ax=sum(x for x,y in pairs)/len(pairs); ay=sum(y for x,y in pairs)/len(pairs)
    vx=sum((x-ax)**2 for x,y in pairs);vy=sum((y-ay)**2 for x,y in pairs)
    if vx<=0 or vy<=0:return None
    return sum((x-ax)*(y-ay) for x,y in pairs)/math.sqrt(vx*vy)


def raw_season_validation(team_game_rows,season_adv,asof):
    # Diagnostic only: compare reconstructed cumulative raw PPO/field position against
    # CFBD's official prior-week season aggregates. This does not tune the challenger.
    accum=defaultdict(lambda:{'ppo_num':0.,'ppo_w':0.,'fp_num':0.,'fp_w':0.})
    for r in team_game_rows:
        if r['week']>asof:continue
        t=r['team']
        for field,numkey,wkey in [('ppo','ppo_num','ppo_w'),('fieldPosition','fp_num','fp_w')]:
            v=r['values'][field];w=r['weights'][field]
            if m.finite(v):accum[t][numkey]+=v*w;accum[t][wkey]+=w
    official={}
    for x in season_adv:
        t=m.canon(x.get('team'));off=x.get('offense') or {}
        if t:official[t]={'ppo':off.get('pointsPerOpportunity'),'fieldPosition':m.dig(off,'fieldPosition','averageStart')}
    ppo_a=[];ppo_b=[];fp_a=[];fp_b=[]
    for t,z in accum.items():
        if t not in official:continue
        if z['ppo_w'] and m.finite(official[t]['ppo']):ppo_a.append(z['ppo_num']/z['ppo_w']);ppo_b.append(float(official[t]['ppo']))
        if z['fp_w'] and m.finite(official[t]['fieldPosition']):fp_a.append(z['fp_num']/z['fp_w']);fp_b.append(float(official[t]['fieldPosition']))
    return {'ppo_corr':corr(ppo_a,ppo_b),'ppo_n':len(ppo_a),'field_position_corr':corr(fp_a,fp_b),'field_position_n':len(fp_a)}


def bootstrap(A,B,n=5000):
    a={(r['year'],r['week'],r['game_id']):r for r in A};b={(r['year'],r['week'],r['game_id']):r for r in B};keys=list(set(a)&set(b))
    d=[b[k]['ae']-a[k]['ae'] for k in keys]
    if not d:return None
    rnd=random.Random(20260909);vals=[];N=len(d)
    for _ in range(n):vals.append(sum(d[rnd.randrange(N)] for __ in range(N))/N)
    vals.sort();return {'n_common':N,'feature_minus_win50_mae':sum(d)/N,'ci95':[vals[int(.025*n)],vals[int(.975*n)-1]]}


def run():
    allrows={y:{} for y in m.YEARS};diag={}
    for y in m.YEARS:
        print('FETCH',y,flush=True)
        games=m.api('/games',{'year':y,'seasonType':'regular','classification':'fbs'}); lines=m.api('/lines',{'year':y,'seasonType':'regular'}); ga=m.api('/stats/game/advanced',{'year':y,'seasonType':'regular','excludeGarbageTime':'true'}); drives=m.api('/drives',{'year':y,'seasonType':'regular'})
        gby={str(g.get('id')):g for g in games};lm=m.line_map(lines);dm=derive_drive_game_metrics(drives)
        diag[str(y)]={'games':len(games),'line_games':len(lines),'game_advanced_rows':len(ga),'drives':len(drives),'weeks':{}}
        for wk in m.WEEKS:
            targets=[g for g in games if int(g.get('week') or 0)==wk]
            if not targets:continue
            asof=wk-1;sa=m.api('/stats/season/advanced',{'year':y,'excludeGarbageTime':'true','startWeek':1,'endWeek':asof,'classification':'fbs'});prior=[g for g in games if int(g.get('week') or 0)<=asof and g.get('completed')]
            raw=m.raw_index(sa,prior,True);allrows[y].setdefault('WIN50',[]).extend(m.score(targets,lm,raw,1,y,wk,'WIN50'))
            tgr=build_team_game_rows(ga,dm,gby,asof)
            for ridge in RIDGES:
                name=f'FEATURE_FULL_R{ridge:g}';rr=adjusted_rating_index(tgr,ridge);allrows[y].setdefault(name,[]).extend(m.score(targets,lm,rr,1,y,wk,name))
            if wk in (3,5,8,12):diag[str(y)]['weeks'][str(wk)]={'team_game_rows':len(tgr),'raw_reconstruction':raw_season_validation(tgr,sa,asof)}
        print('ROWS',y,{k:len(v) for k,v in allrows[y].items()},flush=True)
    names=sorted(set(k for y in m.YEARS for k in allrows[y]));pool={n:[r for y in m.YEARS for r in allrows[y].get(n,[])] for n in names};dev={n:[r for r in pool[n] if r['year']<=2023] for n in names};val={n:[r for r in pool[n] if r['year']>=2024] for n in names}
    cands=[n for n in names if n.startswith('FEATURE_') and dev.get(n) and val.get(n)];cal=[];caled={}
    for n in cands:
        scored=[]
        for s in SCALES:
            sm=m.summary(m.rescale(dev[n],s))
            if sm.get('n',0):scored.append((sm['mae'],s))
        mae,scale=min(scored);caled[n]={'scale':scale,'dev':m.rescale(dev[n],scale),'val':m.rescale(val[n],scale),'all':m.rescale(pool[n],scale)};cal.append({'model':n,'dev_mae':mae,'scale':scale})
    cal.sort(key=lambda x:(x['dev_mae'],x['model']))
    report={'status':'COMPLETE' if cal else 'NO_CANDIDATE','generated_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'method':'FULL FEATURE-LEVEL OPPONENT ADJUSTMENT','spec':{'years':m.YEARS,'weeks':'3-16','development':'2022-23','untouched_validation':'2024-25','production_formula':'1.5*(2.5*PPO + 60*Success + 25*Explosiveness + 5*clamped LineYards + 0.1*FieldPosition)','challenger':'all five production inputs opponent-adjusted separately using prior-week FBS-vs-FBS team-game data; WIN50 removed','ridge_and_scale_selection':'2022-23 all-game MAE only; no ATS tuning and no 2024-25 tuning','drive_note':'PPO scoring opportunities reconstructed from drives reaching <=40 by start/end; field position from drive start yards-to-goal; reconstruction correlations reported'},'diagnostics':diag,'development_ranking':cal,'summary':{},'yearly':{},'bootstrap':{}}
    if not cal:
        with open('sos_feature_adjust_results_v3.json','w') as f:json.dump(report,f,indent=2);return
    best=cal[0]['model'];report['best_feature']=best;report['best_scale']=caled[best]['scale']
    for n in ['WIN50',best]:
        report['summary'][n]={'dev_all':m.summary(dev[n]),'dev_edge11':m.summary(dev[n],True),'val_all':m.summary(val[n]),'val_edge11':m.summary(val[n],True),'all':m.summary(pool[n]),'all_edge11':m.summary(pool[n],True)};report['yearly'][n]={str(y):{'all':m.summary(allrows[y].get(n,[])),'edge11':m.summary(allrows[y].get(n,[]),True)} for y in m.YEARS}
        if n in caled:
            c=caled[n];report['summary'][n+'_DEV_CAL']={'scale':c['scale'],'dev_all':m.summary(c['dev']),'dev_edge11':m.summary(c['dev'],True),'val_all':m.summary(c['val']),'val_edge11':m.summary(c['val'],True),'all':m.summary(c['all']),'all_edge11':m.summary(c['all'],True)}
    report['bootstrap']['best_fixed_vs_WIN50']=bootstrap(val['WIN50'],val[best]);report['bootstrap']['best_devcal_vs_WIN50']=bootstrap(val['WIN50'],caled[best]['val'])
    report['known_saved_production_edge11']={'bets':632,'wins':370,'losses':258,'pushes':4,'profit_units':86.2}
    with open('sos_feature_adjust_results_v3.json','w') as f:json.dump(report,f,indent=2,allow_nan=False)
    print(json.dumps(report,indent=2),flush=True)

if __name__=='__main__':run()
