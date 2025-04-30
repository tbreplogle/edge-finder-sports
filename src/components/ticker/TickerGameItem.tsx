
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
    // Favorite is the team with negative odds (or the less positive odds if both are positive)
    const homeOdds = game.moneyline;
    const awayOdds = game.moneyline_opponent;
    
    // If both are negative, the more negative is the favorite
    // If both are positive, the lower positive is the favorite
    // If one is negative and one is positive, the negative is the favorite
    const favIsHome = 
      (homeOdds < 0 && awayOdds > 0) || // Home negative, away positive
      (homeOdds < 0 && awayOdds < 0 && homeOdds < awayOdds) || // Both negative, home more negative
      (homeOdds > 0 && awayOdds > 0 && homeOdds < awayOdds); // Both positive, home less positive
    
    const favTeam = favIsHome ? game.home : game.away;
    const favPrice = favIsHome ? homeOdds : awayOdds;
    
    // Format with + sign for positive odds
    const formattedPrice = favPrice > 0 ? `+${favPrice}` : `${favPrice}`;
    
    oddsDisplay = (
      <div className="text-xs">
        <span className="text-muted-foreground mr-1">Fav:</span>
        <span className="font-medium">{favTeam} {formattedPrice}</span>
      </div>
    );
  } else if (!isBaseball && game.spread !== 0) {
    // For point spreads, the favorite is indicated by negative spread
    const favoredTeam = game.spread < 0 ? game.home : game.away;
    const spreadValue = Math.abs(game.spread);
    
    oddsDisplay = (
      <div className="text-xs">
        <span className="text-muted-foreground mr-1">Spread:</span>
        <span className="font-medium">{favoredTeam} -{spreadValue}</span>
      </div>
    );
  }

  /* ---------------- RENDER ---------------- */
  return (
    <div className="flex items-center px-3 py-2 bg-card border border-border/30 rounded-md whitespace-nowrap">
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
            <div className="mt-1">
              {oddsDisplay}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
