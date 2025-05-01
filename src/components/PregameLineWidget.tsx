
import { useEffect, useRef } from 'react';

export function PregameLineWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Don't inject twice
    if (document.querySelector('script[src*="pregame.com/assets/scripts/tear"]'))
      return;

    const s = document.createElement('script');
    s.src = 'https://pregame.com/assets/scripts/tear/tear.js';
    s.dataset.type = 'generic';
    s.dataset.url = 'https://pregame.com/game-center?ts_i=game-center';
    
    // 🔑 append inside the container
    containerRef.current.appendChild(s);

    return () => {
      // Cleanup when component unmounts
      const script = document.querySelector('script[src*="pregame.com/assets/scripts/tear"]');
      if (script) {
        script.remove();
      }
      // Also remove any iframe that might have been injected
      const iframe = document.querySelector('#pregame-game-center iframe');
      if (iframe) {
        iframe.remove();
      }
    };
  }, []);

  return (
    <div className="w-full my-4">
      {/* Pregame's script will replace this div with its iframe */}
      <div id="pregame-game-center" ref={containerRef} className="w-full max-w-6xl mx-auto" />
    </div>
  );
}
