
import React, { useEffect, useRef } from 'react';

export function PregameLineWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // wipe old contents (hot reload)
    containerRef.current.innerHTML = '';

    // 1) load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://pregame.com/assets/styles/site.v2.css';   // main stylesheet
    containerRef.current.appendChild(link);

    // 2) load JS widget
    const s = document.createElement('script');
    s.src = 'https://pregame.com/assets/scripts/tear/tear.js';
    s.dataset.type = 'generic';
    s.dataset.url = 'https://pregame.com/game-center?ts_i=game-center';
    containerRef.current.appendChild(s);

    return () => {
      // Cleanup when component unmounts
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      // Remove any iframe or script that might have been injected in the document
      const script = document.querySelector('script[src*="pregame.com/assets/scripts/tear"]');
      if (script && script.parentNode !== containerRef.current) {
        script.remove();
      }
      // Also remove any iframe that might have been injected
      const iframe = document.querySelector('iframe[src*="pregame.com/game-center"]');
      if (iframe && iframe.parentNode !== containerRef.current) {
        iframe.remove();
      }
    };
  }, []);

  return (
    <div className="w-full my-4">
      <div 
        id="pregame-game-center" 
        ref={containerRef} 
        className="w-full max-w-6xl mx-auto min-h-[700px] rounded-lg border border-border/20"
      />
    </div>
  );
}
