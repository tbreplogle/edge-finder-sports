
import { Badge } from '@/components/ui/badge';
import { TickerGame } from '@/utils/types/sports';
import { Separator } from "@/components/ui/separator";

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
        <span className="text-muted-foreground mr-1">Fav:</span>
        <span>{favTeam} {sign}{favPrice}</span>
      </div>
    );
  } else if (!isBaseball && game.spread !== 0) {
    const favTeam = game.spread > 0 ? game.away : game.home;
    const favSpread = Math.abs(game.spread);
    oddsDisplay = (
      <div className="text-xs">
        <span className="text-muted-foreground mr-1">Spread:</span>
        <span>{favTeam} {favSpread > 0 ? '-' : '+'}{favSpread}</span>
      </div>
    );
  }

  /* ---------------- RENDER ---------------- */
  return (
    <div className="flex items-center px-3 py-1 bg-card border border-border/30 rounded-md whitespace-nowrap">
      {isFinal ? (
        <>
          <span className="font-medium text-sm">
            {game.away} {game.score_away}
          </span>
          <span className="text-muted-foreground mx-1.5">@</span>
          <span className="font-medium text-sm">
            {game.home} {game.score_home}
          </span>
          <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
            FINAL
          </Badge>
        </>
      ) : (
        <div className="flex flex-col">
          <div className="flex items-center">
            <span className="font-medium text-sm">{game.away}</span>
            <span className="text-muted-foreground mx-1.5">@</span>
            <span className="font-medium text-sm">{game.home}</span>
            {game.tip && (
              <span className="text-xs text-muted-foreground ml-2">{game.tip}</span>
            )}
          </div>
          {oddsDisplay && (
            <div className="mt-0.5">
              {oddsDisplay}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
