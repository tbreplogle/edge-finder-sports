
import { Badge } from '@/components/ui/badge';
import { TickerGame } from '@/utils/types/sports';
import { getTeamAbbreviation } from '@/utils/helpers/teamAbbreviations';

interface Props {
  game: TickerGame;
}

export const TickerGameItem = ({ game }: Props) => {
  const isFinal = game.final;
  const isBaseball = game.sport_key?.includes('baseball');
  
  // Use team abbreviations
  const homeTeam = getTeamAbbreviation(game.home);
  const awayTeam = getTeamAbbreviation(game.away);

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
    
    const favTeam = favIsHome ? homeTeam : awayTeam;
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
    const favoredTeam = game.spread < 0 ? homeTeam : awayTeam;
    const spreadValue = Math.abs(game.spread);
    
    oddsDisplay = (
      <div className="text-xs">
        <span className="text-muted-foreground mr-1">Fav:</span>
        <span className="font-medium">{favoredTeam} -{spreadValue}</span>
      </div>
    );
  }

  /* ---------------- RENDER ---------------- */
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-edge-primary text-white rounded-none whitespace-nowrap border-l border-r border-edge-neutral/30">
      {isFinal ? (
        <>
          {/* Final game display */}
          <div className="flex items-center">
            <div className="flex flex-col mr-1.5">
              <span className="font-medium text-sm">{awayTeam}</span>
              <span className="font-medium text-sm">{homeTeam}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-sm">{game.score_away}</span>
              <span className="font-medium text-sm">{game.score_home}</span>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-secondary border-secondary">
            FINAL
          </Badge>
        </>
      ) : (
        <div className="flex items-center justify-between w-full">
          {/* Live/Upcoming game display */}
          <div className="flex items-center">
            <div className="flex flex-col">
              <div className="flex items-center justify-between w-20">
                <span className="font-medium text-sm">{awayTeam}</span>
                {!isBaseball && game.spread > 0 && (
                  <span className="text-xs text-muted-foreground">+{Math.abs(game.spread)}</span>
                )}
                {!isBaseball && game.spread < 0 && (
                  <span className="text-xs text-secondary">-{Math.abs(game.spread)}</span>
                )}
                {isBaseball && game.moneyline_opponent !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {game.moneyline_opponent > 0 ? `+${game.moneyline_opponent}` : game.moneyline_opponent}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between w-20">
                <span className="font-medium text-sm">{homeTeam}</span>
                {!isBaseball && game.spread < 0 && (
                  <span className="text-xs text-muted-foreground">+{Math.abs(game.spread)}</span>
                )}
                {!isBaseball && game.spread > 0 && (
                  <span className="text-xs text-secondary">-{Math.abs(game.spread)}</span>
                )}
                {isBaseball && game.moneyline !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {game.moneyline > 0 ? `+${game.moneyline}` : game.moneyline}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Right side info */}
          <div className="flex items-center">
            {oddsDisplay}
            
            {game.total && !oddsDisplay && (
              <div className="text-xs">
                <span className="text-muted-foreground mr-1">O/U:</span>
                <span className="font-medium">{game.total}</span>
              </div>
            )}
            
            {game.tip && (
              <span className="text-xs font-semibold ml-2">{game.tip}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
