
export function sanitizePrediction(prediction: any, userRole?: string | null) {
  // Allow admins and paid users to access premium data
  if (userRole === 'premium' || userRole === 'admin') {
    return prediction;
  }

  // For anonymous or free users, mask premium data
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
  return predictions.map(prediction => sanitizePrediction(prediction, userRole));
}
