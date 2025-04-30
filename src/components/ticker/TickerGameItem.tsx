
import { Badge } from '@/components/ui/badge';
import { TickerGame } from '@/utils/types/sports';

interface Props {
  game: TickerGame;
}

export const TickerGameItem = ({ game }: Props) => {
  const isFinal = game.final;
  const isBaseball = game.sport_key?.includes('baseball');

  /* ---------------- ODDS DISPLAY ---------------- */
  let oddsDisplay: JSX.Element | null = null;

  if (isBaseball && game.moneyline !== undefined && game.moneyline_opponent !== undefined) {
    // pick favourite (lower absolute price)
    const favIsHome = Math.abs(game.moneyline) < Math.abs(game.moneyline_opponent);
    const favTeam = favIsHome ? game.home : game.away;
    const favPrice = favIsHome ? game.moneyline : game.moneyline_opponent;
    
    // Only add + sign for positive numbers (underdogs)
    const sign = favPrice > 0 ? '+' : '';
    
    oddsDisplay = (
      <div className="text-xs">
        {favTeam} {sign}{favPrice}
      </div>
    );
  } else if (!isBaseball) {
    const favTeam = game.spread > 0 ? game.away : game.home;
    const favSpread = Math.abs(game.spread);
    oddsDisplay = (
      <div className="text-xs">
        {favTeam} {favSpread > 0 ? '+' : '-'}{favSpread}
      </div>
    );
  }

  /* ---------------- RENDER ---------------- */
  return (
    <div className="flex items-center space-x-2 px-3 py-1 bg-card border border-border/30 rounded-md whitespace-nowrap">
      {isFinal ? (
        <>
          <span className="font-semibold">
            {game.away} {game.score_away}
          </span>
          <span className="text-muted-foreground mx-1">@</span>
          <span className="font-semibold">
            {game.home} {game.score_home}
          </span>
          <Badge variant="outline" className="ml-1 text-xs">
            FINAL
          </Badge>
        </>
      ) : (
        <>
          <span className="font-semibold">{game.away}</span>
          <span className="text-muted-foreground mx-1">@</span>
          <span className="font-semibold">{game.home}</span>
          <span className="text-xs text-muted-foreground">{game.tip}</span>
          {oddsDisplay}
        </>
      )}
    </div>
  );
};
