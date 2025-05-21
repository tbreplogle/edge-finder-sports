/* …imports unchanged… */

import { ProcessedMlbPrediction } from "@/utils/fetchMlbPredictions";

/* ========================================================================= */
const MlbDashboard = () => {
  /* …all the state & hooks remain identical… */

  /* ----------------  RENDER  ---------------- */
  return (
    <AppLayout isAuthenticated>
      {/* header … */}

      {/* ---------- featured game ---------- */}
      {featuredGame && (
        <section className="mb-8">
          {/* …heading omitted… */}
          <div className="max-w-5xl mx-auto">
            <GameCard
              {...featuredGame}
              variant="featured"
              isAdmin={isAdmin}
              isPremium={false}
            />
          </div>
        </section>
      )}

      {/* ---------- preview game ---------- */}
      {previewGame && (
        <section className="mb-8">
          {/* …heading omitted… */}
          <div className="max-w-5xl mx-auto">
            <GameCard
              {...previewGame}
              variant="regular"
              isPreviewGame
              isAdmin={isAdmin}
              isPremium={false}
            />
          </div>
        </section>
      )}

      {/* ---------- ALL GAMES -------------- */}
      {access === "full" && (
        <>
          <h2 className="text-xl font-bold mb-4">MLB Games</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {predictions.map((g) => (
              <GameCard
                key={g.matchup_id}
                {...g}
                variant="regular"
                isAdmin={isAdmin}
                isPremium={false}
              />
            ))}
          </div>
        </>
      )}

      {/* …locked card & legend identical… */}
    </AppLayout>
  );
};
export default MlbDashboard;
