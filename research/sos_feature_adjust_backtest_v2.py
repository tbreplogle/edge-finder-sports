import json, time
import sos_feature_adjust_backtest as m


def run():
    allrows={y:{} for y in m.YEARS}
    diagnostics={}
    for y in m.YEARS:
        print('FETCH',y,flush=True)
        games=m.api('/games',{'year':y,'seasonType':'regular','classification':'fbs'})
        lines=m.api('/lines',{'year':y,'seasonType':'regular'})
        ga=m.api('/stats/game/advanced',{'year':y,'seasonType':'regular','excludeGarbageTime':'true'})
        diagnostics[str(y)]={'games':len(games),'line_games':len(lines),'game_advanced_rows':len(ga),'weeks':{}}
        print('COUNTS',y,'games',len(games),'line_games',len(lines),'game_adv',len(ga),flush=True)
        gby={str(g.get('id')):g for g in games}; lm=m.line_map(lines)
        for wk in m.WEEKS:
            targets=[g for g in games if int(g.get('week') or 0)==wk]
            if not targets: continue
            asof=wk-1
            sa=m.api('/stats/season/advanced',{'year':y,'excludeGarbageTime':'true','startWeek':1,'endWeek':asof,'classification':'fbs'})
            prior=[g for g in games if int(g.get('week') or 0)<=asof and g.get('completed')]
            diagnostics[str(y)]['weeks'][str(wk)]={'targets':len(targets),'season_adv':len(sa),'prior_games':len(prior)}
            for name,rr in [('WIN50',m.raw_index(sa,prior,False)),('WIN50_CAP50',m.raw_index(sa,prior,True))]:
                allrows[y].setdefault(name,[]).extend(m.score(targets,lm,rr,1,y,wk,name))
            for ridge in m.RIDGES:
                for mode,fbs in [('FBS_ONLY',True),('ALL_OPP',False)]:
                    name=f'FEATURE_R{ridge:g}_{mode}'
                    rr=m.feature_index(ga,gby,asof,ridge,fbs)
                    allrows[y].setdefault(name,[]).extend(m.score(targets,lm,rr,1,y,wk,name))
        print('MODEL_ROWS',y,{k:len(v) for k,v in allrows[y].items()},flush=True)
        print('DONE',y,flush=True)

    names=sorted(set(k for y in m.YEARS for k in allrows[y]))
    pool={n:[r for y in m.YEARS for r in allrows[y].get(n,[])] for n in names}
    dev={n:[r for r in pool[n] if r['year']<=2023] for n in names}
    val={n:[r for r in pool[n] if r['year']>=2024] for n in names}
    candidates=[n for n in names if n.startswith('FEATURE_') and len(dev.get(n,[])) and len(val.get(n,[]))]
    skipped=[n for n in names if n.startswith('FEATURE_') and n not in candidates]
    print('CANDIDATES',[(n,len(dev[n]),len(val[n])) for n in candidates],flush=True)
    print('SKIPPED',[(n,len(dev.get(n,[])),len(val.get(n,[]))) for n in skipped],flush=True)
    if not candidates:
        report={'status':'NO_USABLE_FEATURE_CANDIDATES','diagnostics':diagnostics,'model_row_counts':{n:{'development':len(dev.get(n,[])),'validation':len(val.get(n,[]))} for n in names}}
        with open('sos_feature_adjust_results.json','w') as f: json.dump(report,f,indent=2)
        return

    calibrated={}; ranking=[]
    for n in candidates:
        scored=[]
        for s in m.SCALES:
            sm=m.summary(m.rescale(dev[n],s))
            if sm.get('n',0) and 'mae' in sm: scored.append((sm['mae'],s))
        if not scored: continue
        mae,scale=min(scored)
        calibrated[n]={'scale':scale,'dev':m.rescale(dev[n],scale),'val':m.rescale(val[n],scale),'all':m.rescale(pool[n],scale)}
        ranking.append({'model':n,'dev_mae':mae,'scale':scale})
    ranking.sort(key=lambda x:(x['dev_mae'],x['model']))
    if not ranking:
        report={'status':'NO_CALIBRATABLE_FEATURE_CANDIDATES','diagnostics':diagnostics}
        with open('sos_feature_adjust_results.json','w') as f: json.dump(report,f,indent=2)
        return
    best=ranking[0]['model']

    report={
      'status':'COMPLETE','generated_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
      'spec':{'years':m.YEARS,'weeks':'3-16','hfa':m.HFA,'edge':m.EDGE,'line':'OPENING','feature_formula':'same production PPO + Success + Explosiveness + LineYards + FieldPosition coefficients; no WIN50','fit':'two-way offense/opponent-defense ridge, prior weeks only','selection':'ridge/mode/scale selected only on 2022-23 all-game MAE; 2024-25 untouched'},
      'diagnostics':diagnostics,
      'model_row_counts':{n:{'development':len(dev.get(n,[])),'validation':len(val.get(n,[]))} for n in names},
      'known_saved_production_baseline':{'bets':632,'wins':370,'losses':258,'pushes':4,'ats_pct':370/628,'profit_units':86.2,'roi':86.2/632},
      'development_ranking':ranking,'best_feature':best,'best_scale':calibrated[best]['scale'],'summary':{},'yearly':{},'bootstrap':{}
    }
    compare=list(dict.fromkeys([n for n in ['WIN50','WIN50_CAP50',best,'FEATURE_R3_FBS_ONLY','FEATURE_R3_ALL_OPP'] if n in pool]))
    for n in compare:
        report['summary'][n]={'dev_all':m.summary(dev[n]),'dev_edge11':m.summary(dev[n],True),'val_all':m.summary(val[n]),'val_edge11':m.summary(val[n],True),'all':m.summary(pool[n]),'all_edge11':m.summary(pool[n],True)}
        report['yearly'][n]={str(y):{'all':m.summary(allrows[y].get(n,[])),'edge11':m.summary(allrows[y].get(n,[]),True)} for y in m.YEARS}
        if n in calibrated:
            c=calibrated[n]
            report['summary'][n+'_DEV_CAL']={'scale':c['scale'],'dev_all':m.summary(c['dev']),'dev_edge11':m.summary(c['dev'],True),'val_all':m.summary(c['val']),'val_edge11':m.summary(c['val'],True),'all':m.summary(c['all']),'all_edge11':m.summary(c['all'],True)}
    report['bootstrap'][best+'_FIXED_vs_WIN50']=m.bootstrap(val['WIN50'],val[best])
    report['bootstrap'][best+'_DEVCAL_vs_WIN50']=m.bootstrap(val['WIN50'],calibrated[best]['val'])
    if 'FEATURE_R3_FBS_ONLY' in val:
        report['bootstrap']['R3_FBS_FIXED_vs_WIN50']=m.bootstrap(val['WIN50'],val['FEATURE_R3_FBS_ONLY'])
    if 'FEATURE_R3_FBS_ONLY' in calibrated:
        report['bootstrap']['R3_FBS_DEVCAL_vs_WIN50']=m.bootstrap(val['WIN50'],calibrated['FEATURE_R3_FBS_ONLY']['val'])
    with open('sos_feature_adjust_results.json','w') as f: json.dump(report,f,indent=2,allow_nan=False)
    print(json.dumps(report,indent=2),flush=True)

if __name__=='__main__': run()
