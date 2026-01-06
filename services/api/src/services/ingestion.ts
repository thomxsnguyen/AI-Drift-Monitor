import { Pool } from 'pg';
import axios from 'axios';

/**
 * Ingest data from external sources or generate sample data for monitoring
 */
export async function ingestData(pool: Pool): Promise<void> {
  console.log('Starting data ingestion...');

  // This is a sample implementation. In production, you would:
  // 1. Fetch data from your ML models
  // 2. Extract feature distributions
  // 3. Compare with baseline distributions
  // 4. Store drift metrics

  try {
    // Sample: Generate random distribution for demonstration
    const baselineDistribution = generateSampleDistribution(100);
    const currentDistribution = generateSampleDistribution(100, 0.1); // With some drift

    // Call the drift calculation endpoint (internal)
    const response = await axios.post('http://localhost:3000/api/drift/calculate', {
      baseline: baselineDistribution,
      current: currentDistribution,
      modelId: 'model-' + Date.now(),
    });

    console.log('Ingestion result:', response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
      console.log('Server not yet ready for internal API calls, skipping this cycle');
    } else {
      throw error;
    }
  }
}

/**
 * Generate a sample distribution for testing
 */
function generateSampleDistribution(size: number, drift: number = 0): number[] {
  const distribution: number[] = [];
  for (let i = 0; i < size; i++) {
    // Generate values following a normal-like distribution with optional drift
    const base = Math.exp(-Math.pow(i - size / 2, 2) / (2 * Math.pow(size / 4, 2)));
    const driftValue = drift * (Math.random() - 0.5) * 2;
    distribution.push(Math.max(0, base + driftValue));
  }
  return distribution;
}
