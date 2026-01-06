/**
 * Calculate cosine similarity between two vectors
 */
export function calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Calculate Kullback-Leibler (KL) divergence between two probability distributions
 * KL(P||Q) = sum(P(i) * log(P(i) / Q(i)))
 */
export function calculateKLDivergence(p: number[], q: number[]): number {
  if (p.length !== q.length) {
    throw new Error('Distributions must have the same length');
  }

  // Normalize distributions to ensure they sum to 1
  const sumP = p.reduce((acc, val) => acc + val, 0);
  const sumQ = q.reduce((acc, val) => acc + val, 0);

  if (sumP === 0 || sumQ === 0) {
    throw new Error('Distributions cannot sum to zero');
  }

  const normalizedP = p.map(val => val / sumP);
  const normalizedQ = q.map(val => val / sumQ);

  let divergence = 0;
  const epsilon = 1e-10; // Small value to prevent log(0)

  for (let i = 0; i < normalizedP.length; i++) {
    if (normalizedP[i] > epsilon) {
      const qVal = Math.max(normalizedQ[i], epsilon);
      divergence += normalizedP[i] * Math.log(normalizedP[i] / qVal);
    }
  }

  return divergence;
}
