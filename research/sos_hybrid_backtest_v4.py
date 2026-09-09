import json, math, time, random
from collections import defaultdict
import sos_feature_adjust_backtest as m
import sos_feature_adjust_backtest_v3 as f

FEATURE_RIDGE=3.0
FEATURE_SCALES=[round(0.70+i*0.025,3) for i in range(21)]  # 0.70..1.20
WIN50_ALPHAS=[round(i*0.05,2) for i in range(21)]           # 0.00..1.00
BALANCED_MAE_TOL=0.20
BALANCED_MIN_BETS=200
ROI_MIN_BETS=200


def raw_base_and_win50(season_adv, prior):
    b=defaultdict(list); labels=defaultdict(set)
    for x in season_adv:
        k=m.canon(x.get('team')); c=m.raw_components(x)
        if k and m.finite(c['base']):
            b[k].append(c); labels[k].add(str(x.get('team','')).strip().upper())
    base={}; amb=set(); fields=['ppa','ppo','success','havoc','lineYards','explosiveness','fieldPosition','base']
    for k,a in b.items():
        uniq={tuple(round(float(c[z]),12) if m.finite(c[z]) else None for z in fields):c for c in a}
        if len(labels[k])!=1 or len(uniq)!=1:
            amb.add(k); continue
        base[k]=next(iter(uniq.values()))['base']
    opp=defaultdict(list)
    for g in prior:
        hc=str(g.get('homeClassification') or g.get('homeDivision') or '').lower()
        ac=str(g.get('awayClassification') or g.get('awayDivision') or '').lower()
        if not g.get('completed') or hc!='fbs' or ac!='fbs': continue
        h,a=m.canon(g.get('homeTeam')),m.canon(g.get('awayTeam'))
        if not h or not a or h==a: continue
        order=float(g.get('week') or 0)*1e10+float(g.get('id') or 0)
        opp[h].append((order,a)); opp[a].append((order,h))
    adj={}; total={}
    for k,v in base.items():
        os=[base[o] for _,o in sorted(opp.get(k,[]))[-12:] if o not in amb and o in base]
        a=m.win50(os,True) if os else 0.0
        adj[k]=a; total[k]=v+a
    return base,adj,total


def hybrid_index(feature, win50_adj, feature_scale, alpha):
    teams=set(feature)&set(win50_adj)
    return {t:feature_scale*feature[t] + alpha*win50_adj[t] for t in teams}


def bootstrap(A,B,n=5000):
    a={(r['year'],r['week'],r['game_id']):r for r in A}; b={(r['year'],r['week'],r['game_id']):r for r in B}
    keys=list(set(a)&set(b)); d=[b[k]['ae']-a[k]['ae'] for k in keys]
    if not d:return None
    rnd=random.Random(20260909); vals=[]; N=len(d)
    for _ in range(n): vals.append(sum(d[rnd.randrange(N)] for __ in range(N))/N)
    vals.sort()
    return {'n_common':N,'B_minus_A_mae':sum(d)/N,'ci95':[vals[int(.025*n)],vals[int(.975*n)-1]]}


def yearly(rows):
    return {str(y):{'all':m.summary([r for r in rows if r['year']==y]),'edge11':m.summary([r for r in rows if r['year']==y],True)} for y in m.YEARS}


def run():
    allrows={y:{'WIN50':[],'FEATURE_ONLY':[]} for y in m.YEARS}
    hybrid_rows={(s,a):[] for s in FEATURE_SCALES for a in WIN50_ALPHAS}
    diagnostics={}
    for y in m.YEARS:
        print('FETCH',y,flush=True)
        games=m.api('/games',{'year':y,'seasonType':'regular','classification':'fbs'})
        lines=m.api('/lines',{'year':y,'seasonType':'regular'})
        ga=m.api('/stats/game/advanced',{'year':y,'seasonType':'regular','excludeGarbageTime':'true'})
        drives=m.api('/drives',{'year':y,'seasonType':'regular'})
        gby={str(g.get('id')):g for g in games}; lm=m.line_map(lines); dm=f.derive_drive_game_metrics(drives)
        diagnostics[str(y)]={'weeks':{}}
        for wk in m.WEEKS:
            targets=[g for g in games if int(g.get('week') or 0)==wk]
            if not targets:continue
            asof=wk-1
            sa=m.api('/stats/season/advanced',{'year':y,'excludeGarbageTime':'true','startWeek':1,'endWeek':asof,'classification':'fbs'})
            prior=[g for g in games if int(g.get('week') or 0)<=asof and g.get('completed')]
            base,adj,prod=raw_base_and_win50(sa,prior)
            tgr=f.build_team_game_rows(ga,dm,gby,asof)
            feat=f.adjusted_rating_index(tgr,FEATURE_RIDGE)
            allrows[y]['WIN50'].extend(m.score(targets,lm,prod,1,y,wk,'WIN50'))
            allrows[y]['FEATURE_ONLY'].extend(m.score(targets,lm,feat,1,y,wk,'FEATURE_ONLY'))
            for s in FEATURE_SCALES:
                for a in WIN50_ALPHAS:
                    rr=hybrid_index(feat,adj,s,a)
                    hybrid_rows[(s,a)].extend(m.score(targets,lm,rr,1,y,wk,f'HYBRID_S{s}_A{a}'))
            diagnostics[str(y)]['weeks'][str(wk)]={'feature_teams':len(feat),'win50_teams':len(adj),'common_teams':len(set(feat)&set(adj))}
        print('DONE',y,flush=True)

    win50=[r for y in m.YEARS for r in allrows[y]['WIN50']]
    feature=[r for y in m.YEARS for r in allrows[y]['FEATURE_ONLY']]
    dev_win=[r for r in win50 if r['year']<=2023]; val_win=[r for r in win50 if r['year']>=2024]
    dev_feat=[r for r in feature if r['year']<=2023]; val_feat=[r for r in feature if r['year']>=2024]

    grid=[]
    for (s,a),rows in hybrid_rows.items():
        dev=[r for r in rows if r['year']<=2023]; val=[r for r in rows if r['year']>=2024]
        da=m.summary(dev); de=m.summary(dev,True); va=m.summary(val); ve=m.summary(val,True)
        grid.append({'feature_scale':s,'win50_alpha':a,'dev_all':da,'dev_edge11':de,'val_all':va,'val_edge11':ve})
    valid=[g for g in grid if g['dev_all'].get('n',0)>0]
    mae_champ=min(valid,key=lambda g:(g['dev_all']['mae'],g['feature_scale'],g['win50_alpha']))
    best_mae=mae_champ['dev_all']['mae']
    balanced_pool=[g for g in valid if g['dev_all']['mae']<=best_mae+BALANCED_MAE_TOL and g['dev_edge11'].get('bets',0)>=BALANCED_MIN_BETS]
    balanced=max(balanced_pool,key=lambda g:(g['dev_edge11'].get('roi',-999),-g['dev_all']['mae'])) if balanced_pool else mae_champ
    roi_pool=[g for g in valid if g['dev_edge11'].get('bets',0)>=ROI_MIN_BETS]
    roi_champ=max(roi_pool,key=lambda g:(g['dev_edge11'].get('roi',-999),-g['dev_all']['mae'])) if roi_pool else mae_champ

    def rows_for(g):return hybrid_rows[(g['feature_scale'],g['win50_alpha'])]
    selected={'MAE_CHAMPION':mae_champ,'BALANCED_CHAMPION':balanced,'DEV_ROI_CHAMPION':roi_champ}
    report={
      'status':'COMPLETE','generated_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
      'method':'FEATURE-LEVEL OPPONENT ADJUSTMENT + DAMPED WIN50',
      'spec':{
        'years':m.YEARS,'weeks':'3-16','development':'2022-23','untouched_validation':'2024-25','edge':m.EDGE,
        'feature_ridge':FEATURE_RIDGE,
        'hybrid_formula':'rating = feature_scale * opponent_adjusted_feature_rating + win50_alpha * production_WIN50_adjustment; HFA unchanged',
        'feature_scale_grid':[min(FEATURE_SCALES),max(FEATURE_SCALES),0.025],
        'win50_alpha_grid':[min(WIN50_ALPHAS),max(WIN50_ALPHAS),0.05],
        'selection_rules':{
          'MAE_CHAMPION':'lowest 2022-23 all-game MAE',
          'BALANCED_CHAMPION':f'highest 2022-23 Edge11 ROI among configs within {BALANCED_MAE_TOL:.2f} MAE of dev best and >= {BALANCED_MIN_BETS} bets',
          'DEV_ROI_CHAMPION':f'highest 2022-23 Edge11 ROI with >= {ROI_MIN_BETS} bets; diagnostic because betting-objective tuning is higher overfit risk'
        },
        'validation_rule':'2024-25 not used for parameter selection'
      },
      'baselines':{
        'WIN50':{'dev_all':m.summary(dev_win),'dev_edge11':m.summary(dev_win,True),'val_all':m.summary(val_win),'val_edge11':m.summary(val_win,True),'yearly':yearly(win50)},
        'FEATURE_ONLY':{'dev_all':m.summary(dev_feat),'dev_edge11':m.summary(dev_feat,True),'val_all':m.summary(val_feat),'val_edge11':m.summary(val_feat,True),'yearly':yearly(feature)}
      },
      'selected':{},'alpha_sweep_scale_1':[], 'bootstrap':{}, 'diagnostics':diagnostics
    }
    for name,g in selected.items():
        rows=rows_for(g); dev=[r for r in rows if r['year']<=2023]; val=[r for r in rows if r['year']>=2024]
        report['selected'][name]={'feature_scale':g['feature_scale'],'win50_alpha':g['win50_alpha'],'dev_all':m.summary(dev),'dev_edge11':m.summary(dev,True),'val_all':m.summary(val),'val_edge11':m.summary(val,True),'yearly':yearly(rows)}
        report['bootstrap'][name+'_vs_WIN50']=bootstrap(val_win,val)
        report['bootstrap'][name+'_vs_FEATURE_ONLY']=bootstrap(val_feat,val)
    for a in WIN50_ALPHAS:
        g=next(x for x in grid if x['feature_scale']==1.0 and x['win50_alpha']==a)
        report['alpha_sweep_scale_1'].append({'win50_alpha':a,'dev_mae':g['dev_all']['mae'],'dev_edge11_bets':g['dev_edge11'].get('bets',0),'dev_edge11_ats':g['dev_edge11'].get('ats_pct'),'dev_edge11_roi':g['dev_edge11'].get('roi'),'val_mae':g['val_all']['mae'],'val_edge11_bets':g['val_edge11'].get('bets',0),'val_edge11_ats':g['val_edge11'].get('ats_pct'),'val_edge11_roi':g['val_edge11'].get('roi')})
    # Purely diagnostic oracle: proves whether any tested combo can achieve the desired validation tradeoff; never used for recommendation.
    oracle_candidates=[g for g in grid if g['val_all'].get('mae',999)<=m.summary(val_win)['mae']-0.75 and g['val_edge11'].get('bets',0)>=150]
    report['validation_oracle_not_for_selection']=max(oracle_candidates,key=lambda g:g['val_edge11'].get('ats_pct',-1)) if oracle_candidates else None
    with open('sos_hybrid_results_v4.json','w') as fh:json.dump(report,fh,indent=2,allow_nan=False)
    print(json.dumps(report,indent=2),flush=True)

if __name__=='__main__':run()
