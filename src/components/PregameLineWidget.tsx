
import React from 'react';

export function PregameLineWidget() {
  return (
    <div className="w-full my-4">
      <iframe
        src="https://pregame.com/game-center?ts_i=game-center"
        title="Pregame Line Tracker"
        className="w-full max-w-6xl mx-auto rounded-lg border border-border/20"
        style={{ height: '700px' }}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
      />
    </div>
  );
}
