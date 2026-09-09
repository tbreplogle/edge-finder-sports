import json
import sos_feature_adjust_backtest as m

ga=m.api('/stats/game/advanced',{'year':2024,'seasonType':'regular','excludeGarbageTime':'true'})
print('ROWS',len(ga))
for r in ga[:2]:
    print('TOP_KEYS',sorted(r.keys()))
    print('TEAM',r.get('team'),'OPP',r.get('opponent'),'WEEK',r.get('week'),'GAMEID',r.get('gameId'))
    off=r.get('offense') or {}
    de=r.get('defense') or {}
    print('OFFENSE_KEYS',sorted(off.keys()))
    print('DEFENSE_KEYS',sorted(de.keys()))
    print('OFFENSE_SAMPLE',json.dumps(off,sort_keys=True)[:5000])
