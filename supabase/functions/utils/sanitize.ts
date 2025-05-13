
export function sanitizePrediction(prediction: any, userRole?: string | null) {
  // Allow admins and paid users to access all premium data
  if (userRole === 'premium' || userRole === 'admin') {
    return prediction;
  }

  // For anonymous guests or free users, check if this is a preview game
  if (prediction.isPreviewGame || prediction.isFeaturedGame) {
    return prediction; // Show full data for the preview game and featured game
  }

  // For all other games (not the preview), mask premium data
  const sanitizedPrediction = {
    ...prediction,
    predictedMargin: null,
    edge: null,
    confidence: null,
    rawFactors: null
  };

  // Only return premium field indication if it's actually a premium game
  if (prediction.isPremium) {
    sanitizedPrediction.isPremium = true;
  }

  return sanitizedPrediction;
}

export function sanitizePredictions(predictions: any[], userRole?: string | null) {
  // Keep track of which sports we've seen to identify the first game of each sport
  const sportsSeen: Record<string, boolean> = {};
  
  // For MLB, find the earliest game to mark as preview
  let earliestMlbGame = null;
  let featuredGame = null;
  
  // First pass - identify featured game and earliest game
  for (const prediction of predictions) {
    // Check if this is an MLB game
    if (prediction.sport === 'mlb') {
      // Find featured game (highest edge)
      if (!featuredGame || Math.abs(prediction.edge) > Math.abs(featuredGame.edge)) {
        featuredGame = prediction;
      }
      
      // Find earliest game
      if (!earliestMlbGame || new Date(prediction.startTime) < new Date(earliestMlbGame.startTime)) {
        earliestMlbGame = prediction;
      }
    }
  }
  
  // Second pass - mark games appropriately and sanitize
  return predictions.map(prediction => {
    // If it's the featured game, mark it
    if (featuredGame && prediction.id === featuredGame.id) {
      return sanitizePrediction({...prediction, isFeaturedGame: true}, userRole);
    }
    
    // If it's the earliest game and not the featured game, mark as preview
    if (earliestMlbGame && prediction.id === earliestMlbGame.id && 
        (!featuredGame || prediction.id !== featuredGame.id)) {
      return sanitizePrediction({...prediction, isPreviewGame: true}, userRole);
    }
    
    // Use the original sportsSeen logic for other sports
    if (!sportsSeen[prediction.sport]) {
      sportsSeen[prediction.sport] = true;
      // Mark this as a preview game (for guest users)
      return sanitizePrediction({...prediction, isPreviewGame: true}, userRole);
    }
    
    // Not the first game of this sport
    return sanitizePrediction(prediction, userRole);
  });
}
