
import React from "react";
import { Badge } from "@/components/ui/badge";
import { TickerGame } from "@/utils/types/sports";

interface TickerGameItemProps {
  game: TickerGame;
}

export const TickerGameItem = ({ game }: TickerGameItemProps) => {
  const isFinal = game.final;
  const isBaseball = game.sport_key?.includes('baseball');
  const isNFL = game.sport_key?.includes('americanfootball_nfl');
  const showPrediction = game.show_prediction !== false && !isNFL; // Never show predictions for NFL
  
  // Display appropriate odds based on sport and predictions
  let oddsDisplay;
  if (isBaseball && game.moneyline !== undefined && game.moneyline_opponent !== undefined) {
    // For baseball, show moneyline of the favorite team
    const favIsHome = Math.abs(game.moneyline) < Math.abs(game.moneyline_opponent);
    const favTeam = favIsHome ? game.home : game.away;
    const favPrice = favIsHome ? game.moneyline : game.moneyline_opponent;
    const sign = favPrice > 0 ? '+' : '';
    oddsDisplay = (
      <div className="text-xs">
        {favTeam} {sign}{favPrice}
      </div>
    );
  } else if (showPrediction && game.predicted_margin !== undefined) {
    // Show predicted margin if available and allowed for this sport
    const predictedTeam = game.predicted_margin > 0 ? game.home : game.away;
    const predictedValue = Math.abs(game.predicted_margin).toFixed(1);
    const predictedSign = game.predicted_margin > 0 ? '+' : '-';
    oddsDisplay = (
      <div className="text-xs flex items-center">
        <span className="text-edge-secondary font-medium">{predictedTeam} {predictedSign}{predictedValue}</span>
        <span className="ml-1 text-muted-foreground text-[10px]">(pred)</span>
      </div>
    );
  } else {
    // Default to showing spread
    const spreadTeam = game.spread > 0 ? game.home : game.away;
    const spreadValue = Math.abs(game.spread);
    const spreadSign = game.spread > 0 ? '+' : '-';
    oddsDisplay = <div className="text-xs">{spreadTeam} {spreadSign}{spreadValue}</div>;
  }
  
  return (
    <div className="flex items-center space-x-2 px-3 py-1 bg-card rounded-md border border-border/30 whitespace-nowrap">
      {isFinal ? (
        <>
          <div className="font-semibold">
            <span>{game.away}</span>
            <span className="mx-1 text-muted-foreground">{game.score_away}</span>
          </div>
          <span className="text-muted-foreground">@</span>
          <div className="font-semibold">
            <span>{game.home}</span>
            <span className="mx-1 text-muted-foreground">{game.score_home}</span>
          </div>
          <Badge variant="outline" className="ml-1 text-xs">FINAL</Badge>
        </>
      ) : (
        <>
          <div className="font-semibold">
            <span>{game.away}</span>
          </div>
          <span className="text-muted-foreground">@</span>
          <div className="font-semibold">
            <span>{game.home}</span>
          </div>
          <div className="text-xs text-muted-foreground">{game.tip}</div>
          {oddsDisplay}
        </>
      )}
    </div>
  );
};
