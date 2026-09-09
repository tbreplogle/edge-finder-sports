import os, json, math, time, random, re, unicodedata
from collections import defaultdict
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API='https://api.collegefootballdata.com'
YEARS=[2022,2023,2024,2025]
WEEKS=range(3,17)
HFA=3.5
EDGE=11.0
PREFERRED='draftkings'
RIDGES=[0.0,1.0,3.0,5.0,8.0]
SCALES=[round(0.50+i*0.05,2) for i in range(31)]
ALIASES={'UCONN':'CONNECTICUT','APP STATE':'APPALACHIAN STATE','SOUTHERN MISS':'SOUTHERN MISSISSIPPI','ULM':'UL MONROE','LOUISIANA MONROE':'UL MONROE','MIAMI OHIO':'MIAMI OH','SAM HOUSTON STATE':'SAM HOUSTON','UMASS':'MASSACHUSETTS','NC STATE':'NORTH CAROLINA STATE','CAL':'CALIFORNIA','FIU':'FLORIDA INTERNATIONAL','FAU':'FLORIDA ATLANTIC','UT SAN ANTONIO':'UTSA'}

def canon(s):
    s=unicodedata.normalize('NFD',str(s or '').strip().upper())
    s=''.join(c for c in s if unicodedata.category(c)!='Mn').replace('&',' AND ').replace('’','').replace("'",'')
    s=re.sub(r'[^A-Z0-9]+',' ',s); s=re.sub(r'\s+',' ',s).strip()
    return ALIASES.get(s,s)

def finite(x):
    try:return x is not None and math.isfinite(float(x))
    except:return False

def dig(o,*p):
    for k in p:
        if not isinstance(o,dict):return None
        o=o.get(k)
    return o

def api(path,params):
    key=os.environ.get('CFBD_API_KEY','').strip()
    if not key:raise RuntimeError('CFBD_API_KEY missing')
    url=API+path+'?'+urlencode(params)
    for attempt in range(5):
        try:
            req=Request(url,headers={'Authorization':'Bearer '+key,'Accept':'application/json','User-Agent':'MarketEdge-SOS-Research/1.0'})
            with urlopen(req,timeout=90) as r:return json.loads(r.read().decode())
        except Exception:
            if attempt==4:raise
            time.sleep(2**attempt)

def rh(x):return round(float(x)*2)/2

def ncdf(x):
    t=1/(1+0.2316419*abs(x));d=.3989423*math.exp(-x*x/2)
    p=1-d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))))
    return p if x>=0 else 1-p

def win50(vals,capped=False):
    vals=[float(v) for v in vals if finite(v)]
    if not vals:return 0.0
    lo,hi=(-50.,50.) if capped else (min(vals)-100,max(vals)+100)
    for _ in range(80):
        mid=(lo+hi)/2; p=sum(ncdf((mid-v)/14.4) for v in vals)/len(vals)
        if p<.5:lo=mid
        else:hi=mid
    return (lo+hi)/2

def raw_components(x):
    off=x.get('offense') or {}; de=x.get('defense') or {}
    def m(d,k):return float(d.get(k)) if finite(d.get(k)) else math.nan
    op,dp=m(off,'plays'),m(de,'plays'); olt,dlt=m(off,'lineYardsTotal'),m(de,'lineYardsTotal')
    def diff(k):return m(off,k)-m(de,k) if finite(m(off,k)) and finite(m(de,k)) else math.nan
    ppa=diff('ppa'); ppo=diff('pointsPerOpportunity'); suc=diff('successRate'); exp=diff('explosiveness')
    fo,fd=dig(off,'fieldPosition','averageStart'),dig(de,'fieldPosition','averageStart')
    fp=float(fo)-float(fd) if finite(fo) and finite(fd) else math.nan
    ho,hd=dig(off,'havoc','total'),dig(de,'havoc','total'); havoc=float(hd)-float(ho) if finite(ho) and finite(hd) else math.nan
    ly=olt/op-dlt/dp if all(finite(v) for v in [op,dp,olt,dlt]) and op>0 and dp>0 else math.nan
    ok=all(finite(v) for v in [op,dp,olt,dlt,ppo,suc,exp,fp]) and op>0 and dp>0
    base=1.5*(2.5*ppo+60*suc+25*exp+5*min(max(ly,-.4),.5)+.1*fp) if ok else math.nan
    return {'ppa':ppa,'ppo':ppo,'success':suc,'havoc':havoc,'lineYards':ly,'explosiveness':exp,'fieldPosition':fp,'base':base}

def raw_index(season_adv,prior,capped=False):
    b=defaultdict(list); labels=defaultdict(set)
    for x in season_adv:
        k=canon(x.get('team')); c=raw_components(x)
        if k and finite(c['base']):b[k].append(c);labels[k].add(str(x.get('team','')).strip().upper())
    base={};amb=set()
    fields=['ppa','ppo','success','havoc','lineYards','explosiveness','fieldPosition','base']
    for k,a in b.items():
        u={tuple(round(float(c[z]),12) if finite(c[z]) else None for z in fields):c for c in a}
        if len(labels[k])!=1 or len(u)!=1:amb.add(k);continue
        base[k]=next(iter(u.values()))['base']
    opp=defaultdict(list)
    for g in prior:
        hc=str(g.get('homeClassification') or g.get('homeDivision') or '').lower();ac=str(g.get('awayClassification') or g.get('awayDivision') or '').lower()
        if not g.get('completed') or hc!='fbs' or ac!='fbs':continue
        h,a=canon(g.get('homeTeam')),canon(g.get('awayTeam'))
        if not h or not a or h==a:continue
        order=float(g.get('week') or 0)*1e10+float(g.get('id') or 0);opp[h].append((order,a));opp[a].append((order,h))
    out={}
    for k,v in base.items():
        os=[base[o] for _,o in sorted(opp.get(k,[]))[-12:] if o not in amb and o in base]
        out[k]=v+(win50(os,capped) if os else 0)
    return out

def metric_rows(game_adv,gby,asof,fbs_only):
    rows=[]
    for r in game_adv:
        wk=int(r.get('week') or 0)
        if wk<=0 or wk>asof:continue
        g=gby.get(str(r.get('gameId') or ''))
        if g is not None and not g.get('completed'):continue
        t,o=canon(r.get('team')),canon(r.get('opponent'))
        if not t or not o or t==o:continue
        if fbs_only:
            if not g:continue
            hc=str(g.get('homeClassification') or g.get('homeDivision') or '').lower();ac=str(g.get('awayClassification') or g.get('awayDivision') or '').lower()
            if hc!='fbs' or ac!='fbs':continue
        off=r.get('offense') or {};plays=float(off.get('plays')) if finite(off.get('plays')) else math.nan
        vals={'ppo':float(off.get('pointsPerOpportunity')) if finite(off.get('pointsPerOpportunity')) else math.nan,'success':float(off.get('successRate')) if finite(off.get('successRate')) else math.nan,'explosiveness':float(off.get('explosiveness')) if finite(off.get('explosiveness')) else math.nan,'lineYards':float(off.get('lineYardsTotal'))/plays if finite(off.get('lineYardsTotal')) and finite(plays) and plays>0 else math.nan,'fieldPosition':float(dig(off,'fieldPosition','averageStart')) if finite(dig(off,'fieldPosition','averageStart')) else math.nan}
        if all(finite(v) for v in vals.values()):rows.append({'team':t,'opponent':o,'plays':plays,**vals})
    return rows

def twoway(rows,key,ridge):
    obs=[r for r in rows if finite(r[key])];teams=sorted(set([r['team'] for r in obs]+[r['opponent'] for r in obs]))
    if not obs or not teams:return None
    def w(r):return min(120,max(20,float(r['plays'])))/60 if finite(r['plays']) and float(r['plays'])>0 else 1.
    mean=sum(w(r)*r[key] for r in obs)/sum(w(r) for r in obs);off={t:0. for t in teams};allow={t:0. for t in teams}
    def center(d):
        m=sum(d.values())/len(teams)
        for t in teams:d[t]-=m
    for _ in range(20):
        s=defaultdict(float);wt=defaultdict(float)
        for r in obs:s[r['team']]+=w(r)*(r[key]-mean-allow.get(r['opponent'],0));wt[r['team']]+=w(r)
        for t in teams:off[t]=s[t]/(wt[t]+ridge) if wt[t]+ridge else 0
        center(off);s=defaultdict(float);wt=defaultdict(float)
        for r in obs:s[r['opponent']]+=w(r)*(r[key]-mean-off.get(r['team'],0));wt[r['opponent']]+=w(r)
        for t in teams:allow[t]=s[t]/(wt[t]+ridge) if wt[t]+ridge else 0
        center(allow)
    return off,allow

def feature_index(game_adv,gby,asof,ridge,fbs_only):
    rows=metric_rows(game_adv,gby,asof,fbs_only);fits={k:twoway(rows,k,ridge) for k in ['ppo','success','explosiveness','lineYards','fieldPosition']}
    if any(v is None for v in fits.values()):return {}
    teams=set.intersection(*[set(v[0])&set(v[1]) for v in fits.values()]);out={}
    for t in teams:
        d={k:fits[k][0].get(t,0)-fits[k][1].get(t,0) for k in fits}
        out[t]=1.5*(2.5*d['ppo']+60*d['success']+25*d['explosiveness']+5*min(max(d['lineYards'],-.4),.5)+.1*d['fieldPosition'])
    return out

def line_map(data):
    out={}
    for g in data:
        c=[]
        for ln in g.get('lines') or []:
            if not finite(ln.get('spread')):continue
            c.append((0 if str(ln.get('provider','')).lower()==PREFERRED else 1,ln))
        if c:c.sort(key=lambda x:x[0]);out[str(g.get('id'))]=c[0][1]
    return out

def score(games,lmap,ratings,scale,year,week,name):
    rows=[]
    for g in games:
        hc=str(g.get('homeClassification') or g.get('homeDivision') or '').lower();ac=str(g.get('awayClassification') or g.get('awayDivision') or '').lower()
        if hc!='fbs' or ac!='fbs' or not g.get('completed') or not finite(g.get('homePoints')) or not finite(g.get('awayPoints')):continue
        h,a=canon(g.get('homeTeam')),canon(g.get('awayTeam'))
        if h not in ratings or a not in ratings:continue
        hfa=0. if bool(g.get('neutralSite')) else HFA;rd=ratings[h]-ratings[a];pred=scale*rd+hfa;mspread=rh(-pred);actual=float(g['homePoints'])-float(g['awayPoints'])
        ln=lmap.get(str(g.get('id')));opening=None;provider=''
        if ln:
            op=ln.get('spreadOpen') if finite(ln.get('spreadOpen')) else ln.get('openingSpread')
            if finite(op):opening=float(op)
            provider=str(ln.get('provider',''))
        eh=opening-mspread if opening is not None else None;ea=abs(eh) if eh is not None else None;pick='HOME' if eh is not None and eh>0 else 'AWAY' if eh is not None and eh<0 else 'PASS';ats='';profit=0
        if opening is not None and pick!='PASS':
            cm=(actual+opening)*(1 if pick=='HOME' else -1);ats='W' if cm>0 else 'L' if cm<0 else 'P';profit=1 if ats=='W' else -1.1 if ats=='L' else 0
        rows.append({'model':name,'year':year,'week':week,'game_id':int(g['id']),'rating_diff':rd,'hfa':hfa,'pred':pred,'actual':actual,'ae':abs(actual-pred),'se':(actual-pred)**2,'opening':opening,'provider':provider,'edge_abs':ea,'pick':pick,'ats':ats,'profit':profit})
    return rows

def rescale(rows,s):
    out=[]
    for r in rows:
        z=dict(r);pred=s*r['rating_diff']+r['hfa'];z['pred']=pred;z['ae']=abs(z['actual']-pred);z['se']=(z['actual']-pred)**2;mspread=rh(-pred);op=z['opening']
        if op is not None:
            eh=op-mspread;z['edge_abs']=abs(eh);z['pick']='HOME' if eh>0 else 'AWAY' if eh<0 else 'PASS'
            if z['pick']!='PASS':
                cm=(z['actual']+op)*(1 if z['pick']=='HOME' else -1);z['ats']='W' if cm>0 else 'L' if cm<0 else 'P';z['profit']=1 if z['ats']=='W' else -1.1 if z['ats']=='L' else 0
        out.append(z)
    return out

def summary(rows,bets=False):
    x=[r for r in rows if not bets or (r['edge_abs'] is not None and r['edge_abs']>=EDGE and r['ats'] in 'WLP')]
    if not x:return {'n':0}
    w=sum(r['ats']=='W' for r in x);l=sum(r['ats']=='L' for r in x);p=sum(r['ats']=='P' for r in x);profit=sum(r['profit'] for r in x)
    return {'n':len(x),'mae':sum(r['ae'] for r in x)/len(x),'rmse':math.sqrt(sum(r['se'] for r in x)/len(x)),'bets':w+l+p,'wins':w,'losses':l,'pushes':p,'ats_pct':w/(w+l) if w+l else None,'profit_units':profit,'roi':profit/(w+l+p) if w+l+p else None}

def bootstrap(A,B,n=3000):
    a={(r['year'],r['week'],r['game_id']):r for r in A};b={(r['year'],r['week'],r['game_id']):r for r in B};keys=list(set(a)&set(b));d=[b[k]['ae']-a[k]['ae'] for k in keys]
    rnd=random.Random(20260909);vals=[];m=len(d)
    for _ in range(n):vals.append(sum(d[rnd.randrange(m)] for __ in range(m))/m)
    vals.sort();return {'n_common':m,'feature_minus_win50_mae':sum(d)/m,'ci95':[vals[int(.025*n)],vals[int(.975*n)-1]]}

def main():
    allrows={y:{} for y in YEARS}
    for y in YEARS:
        print('FETCH',y,flush=True);games=api('/games',{'year':y,'seasonType':'regular','classification':'fbs'});lines=api('/lines',{'year':y,'seasonType':'regular'});ga=api('/stats/game/advanced',{'year':y,'seasonType':'regular','excludeGarbageTime':'true'});gby={str(g.get('id')):g for g in games};lm=line_map(lines)
        for wk in WEEKS:
            targets=[g for g in games if int(g.get('week') or 0)==wk]
            if not targets:continue
            asof=wk-1;sa=api('/stats/season/advanced',{'year':y,'excludeGarbageTime':'true','startWeek':1,'endWeek':asof,'classification':'fbs'});prior=[g for g in games if int(g.get('week') or 0)<=asof and g.get('completed')]
            for name,rr in [('WIN50',raw_index(sa,prior,False)),('WIN50_CAP50',raw_index(sa,prior,True))]:allrows[y].setdefault(name,[]).extend(score(targets,lm,rr,1,y,wk,name))
            for ridge in RIDGES:
                for mode,fbs in [('FBS_ONLY',True),('ALL_OPP',False)]:
                    name=f'FEATURE_R{ridge:g}_{mode}';rr=feature_index(ga,gby,asof,ridge,fbs);allrows[y].setdefault(name,[]).extend(score(targets,lm,rr,1,y,wk,name))
        print('DONE',y,flush=True)
    names=sorted(set(k for y in YEARS for k in allrows[y]));pool={n:[r for y in YEARS for r in allrows[y].get(n,[])] for n in names};dev={n:[r for r in pool[n] if r['year']<=2023] for n in names};val={n:[r for r in pool[n] if r['year']>=2024] for n in names}
    cands=[n for n in names if n.startswith('FEATURE_')];cal=[];caled={}
    for n in cands:
        best=min((summary(rescale(dev[n],s))['mae'],s) for s in SCALES);caled[n]={'scale':best[1],'dev':rescale(dev[n],best[1]),'val':rescale(val[n],best[1]),'all':rescale(pool[n],best[1])};cal.append({'model':n,'dev_mae':best[0],'scale':best[1]})
    cal.sort(key=lambda x:(x['dev_mae'],x['model']));best=cal[0]['model'];report={'generated_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'spec':{'years':YEARS,'weeks':'3-16','hfa':HFA,'edge':EDGE,'line':'OPENING','feature_formula':'Production PPO + Success + Explosiveness + LineYards + FieldPosition weights; no WIN50','fit':'two-way offense/defense ridge, prior weeks only','selection':'ridge/mode and optional scalar selected ONLY by 2022-23 all-game MAE; 2024-25 untouched'},'best_feature':best,'best_scale':caled[best]['scale'],'development_ranking':cal,'summary':{},'yearly':{},'bootstrap':{}}
    compare=list(dict.fromkeys(['WIN50','WIN50_CAP50',best,'FEATURE_R3_FBS_ONLY','FEATURE_R3_ALL_OPP']))
    for n in compare:
        report['summary'][n]={'dev_all':summary(dev[n]),'dev_edge11':summary(dev[n],True),'val_all':summary(val[n]),'val_edge11':summary(val[n],True),'all':summary(pool[n]),'all_edge11':summary(pool[n],True)};report['yearly'][n]={str(y):{'all':summary(allrows[y].get(n,[])),'edge11':summary(allrows[y].get(n,[]),True)} for y in YEARS}
        if n.startswith('FEATURE_'):
            report['summary'][n+'_DEV_CAL']={'scale':caled[n]['scale'],'dev_all':summary(caled[n]['dev']),'dev_edge11':summary(caled[n]['dev'],True),'val_all':summary(caled[n]['val']),'val_edge11':summary(caled[n]['val'],True),'all':summary(caled[n]['all']),'all_edge11':summary(caled[n]['all'],True)}
    report['bootstrap'][best+'_FIXED_vs_WIN50']=bootstrap(val['WIN50'],val[best]);report['bootstrap'][best+'_DEVCAL_vs_WIN50']=bootstrap(val['WIN50'],caled[best]['val']);report['bootstrap']['R3_FBS_FIXED_vs_WIN50']=bootstrap(val['WIN50'],val['FEATURE_R3_FBS_ONLY']);report['bootstrap']['R3_FBS_DEVCAL_vs_WIN50']=bootstrap(val['WIN50'],caled['FEATURE_R3_FBS_ONLY']['val'])
    with open('sos_feature_adjust_results.json','w') as f:json.dump(report,f,indent=2,allow_nan=False)
    print(json.dumps(report,indent=2),flush=True)
if __name__=='__main__':main()
