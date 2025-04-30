export function sanitizePrediction(prediction: any, userRole?: string | null) {
  // Allow admins and paid users to access all premium data
  if (userRole === 'premium' || userRole === 'admin') {
    return prediction;
  }

  // For anonymous guests or free users, check if this is the first game of its sport
  // (we'll track this using an object in the sanitizePredictions function)
  if (prediction.isPreviewGame) {
    return prediction; // Show full data for the preview game
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
  
  return predictions.map(prediction => {
    // Check if this is the first game of its sport
    if (!sportsSeen[prediction.sport]) {
      sportsSeen[prediction.sport] = true;
      // Mark this as a preview game (for guest users)
      return sanitizePrediction({...prediction, isPreviewGame: true}, userRole);
    }
    
    // Not the first game of this sport
    return sanitizePrediction(prediction, userRole);
  });
}
