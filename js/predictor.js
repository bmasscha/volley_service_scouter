/**
 * Service Trajectory & Outcome Prediction Engine
 * Computes outcome probabilities (Ace, In, Fault) and predicts
 * likely landing vectors based on historical serves.
 */

class ServePredictor {
  /**
   * Calculate probability distribution for a given player and serve type
   * Uses empirical frequency with Bayesian Laplace smoothing
   * @param {Array} serves All recorded serves
   * @param {string} playerNumber Selected player
   * @param {string} serveType Selected serve type (optional filter)
   */
  static predictOutcome(serves, playerNumber, serveType = null) {
    // 1. Filter serves for this player
    let playerServes = serves.filter(s => String(s.player_number) === String(playerNumber));
    
    // Check if we have specific serves matching the serve type
    let matchingServes = playerServes;
    let isSpecificType = false;

    if (serveType) {
      const typeSpecific = playerServes.filter(s => s.serve_type === serveType);
      if (typeSpecific.length >= 2) {
        matchingServes = typeSpecific;
        isSpecificType = true;
      }
    }

    const totalCount = matchingServes.length;

    if (totalCount === 0) {
      return {
        sampleSize: 0,
        isSpecificType: false,
        confidence: 'No Data',
        probAce: 0,
        probIn: 0,
        probFault: 0,
        notes: `No recorded serves yet for Player #${playerNumber}.`
      };
    }

    // Counts by outcome
    let aceCount = 0;
    let inCount = 0;
    let faultCount = 0;

    matchingServes.forEach(s => {
      if (s.outcome === 'Ace') aceCount++;
      else if (s.outcome === 'In') inCount++;
      else if (s.outcome === 'Fault') faultCount++;
    });

    // Bayesian Dirichlet/Laplace smoothing (alpha = 0.5 prior)
    const alpha = 0.5;
    const smoothedTotal = totalCount + (3 * alpha);
    const pAce = (aceCount + alpha) / smoothedTotal;
    const pIn = (inCount + alpha) / smoothedTotal;
    const pFault = (faultCount + alpha) / smoothedTotal;

    // Confidence tier
    let confidence = 'Low (1-2 serves)';
    if (totalCount >= 7) confidence = 'High (7+ serves)';
    else if (totalCount >= 3) confidence = 'Moderate (3-6 serves)';

    // Qualitative tendency note
    let tendency = '';
    if (aceCount >= 2 && pAce > 0.3) {
      tendency = `Aggressive server with a high ace rate (${Math.round(pAce * 100)}%).`;
    } else if (faultCount >= 2 && pFault > 0.35) {
      tendency = `High risk of fault (${Math.round(pFault * 100)}%). Often presses the net/lines.`;
    } else {
      tendency = `Consistent server (${Math.round(pIn * 100)}% in-play rate).`;
    }

    return {
      sampleSize: totalCount,
      isSpecificType,
      confidence,
      probAce: Math.round(pAce * 100),
      probIn: Math.round(pIn * 100),
      probFault: Math.round(pFault * 100),
      rawCounts: { ace: aceCount, in: inCount, fault: faultCount },
      notes: tendency
    };
  }

  /**
   * Predict the next trajectory vector and target landing zone
   * @param {Array} serves All recorded serves
   * @param {string} playerNumber Selected player
   * @param {string} serveType Selected serve type
   */
  static predictTrajectory(serves, playerNumber, serveType = null) {
    let playerServes = serves.filter(s => String(s.player_number) === String(playerNumber));
    if (playerServes.length === 0) return null;

    // Prioritize successful serves (In & Ace) for landing prediction
    let targetPool = playerServes.filter(s => s.outcome === 'In' || s.outcome === 'Ace');
    if (targetPool.length === 0) {
      targetPool = playerServes; // fallback to all if only faults
    }

    // If serve type specified, check for type matches
    if (serveType) {
      const typeMatches = targetPool.filter(s => s.serve_type === serveType);
      if (typeMatches.length >= 2) {
        targetPool = typeMatches;
      }
    }

    // Calculate centroid start point
    const avgStartX = playerServes.reduce((acc, s) => acc + Number(s.start_x), 0) / playerServes.length;
    const avgStartY = playerServes.reduce((acc, s) => acc + Number(s.start_y), 0) / playerServes.length;

    // Calculate centroid landing point (weighted towards recent serves)
    let totalWeight = 0;
    let weightedEndX = 0;
    let weightedEndY = 0;

    targetPool.forEach((s, idx) => {
      // Recency weighting: more recent serves get slightly more weight
      const weight = 1 + (idx / targetPool.length);
      weightedEndX += Number(s.end_x) * weight;
      weightedEndY += Number(s.end_y) * weight;
      totalWeight += weight;
    });

    const predTargetX = weightedEndX / totalWeight;
    const predTargetY = weightedEndY / totalWeight;

    // Determine predicted zone
    const predictedZone = VolleyballCourt.getOpponentZoneName(predTargetX, predTargetY);

    return {
      start: { x: avgStartX, y: avgStartY },
      target: { x: predTargetX, y: predTargetY },
      zone: predictedZone,
      sampleCount: targetPool.length
    };
  }
}

window.ServePredictor = ServePredictor;
