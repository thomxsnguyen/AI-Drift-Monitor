import { Router, Request, Response } from 'express';
import { pool } from '../index';
import { calculateCosineSimilarity, calculateKLDivergence } from '../utils/metrics';

const router = Router();

// Get all drift metrics
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM drift_metrics ORDER BY created_at DESC LIMIT 100'
    );
    res.json({ metrics: result.rows });
  } catch (error) {
    console.error('Error fetching drift metrics:', error);
    res.status(500).json({ error: 'Failed to fetch drift metrics' });
  }
});

// Get drift metrics by model
router.get('/metrics/:modelId', async (req: Request, res: Response) => {
  const { modelId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM drift_metrics WHERE model_id = $1 ORDER BY created_at DESC LIMIT 50',
      [modelId]
    );
    res.json({ metrics: result.rows });
  } catch (error) {
    console.error('Error fetching drift metrics:', error);
    res.status(500).json({ error: 'Failed to fetch drift metrics' });
  }
});

// Calculate drift between two distributions
router.post('/calculate', async (req: Request, res: Response) => {
  const { baseline, current, modelId } = req.body;

  if (!baseline || !current || !Array.isArray(baseline) || !Array.isArray(current)) {
    return res.status(400).json({ error: 'Invalid input: baseline and current must be arrays' });
  }

  if (baseline.length !== current.length) {
    return res.status(400).json({ error: 'Baseline and current distributions must have the same length' });
  }

  try {
    const cosineSimilarity = calculateCosineSimilarity(baseline, current);
    const klDivergence = calculateKLDivergence(baseline, current);
    
    const cosineDistance = 1 - cosineSimilarity;

    // Store metrics in database
    const result = await pool.query(
      `INSERT INTO drift_metrics (model_id, cosine_distance, kl_divergence, baseline_distribution, current_distribution)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [modelId || 'default', cosineDistance, klDivergence, JSON.stringify(baseline), JSON.stringify(current)]
    );

    res.json({
      success: true,
      metrics: {
        cosineDistance,
        cosineSimilarity,
        klDivergence,
      },
      stored: result.rows[0],
    });
  } catch (error) {
    console.error('Error calculating drift metrics:', error);
    res.status(500).json({ error: 'Failed to calculate drift metrics' });
  }
});

export { router as driftRouter };
