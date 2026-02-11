const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEFAULT_MODEL_ID = 1;

// Database query helper
async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

// Route handlers
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/inference", async (req, res) => {
  try {
    const {
      model_id = DEFAULT_MODEL_ID,
      input_data,
      prediction,
      confidence,
      embedding,
    } = req.body;

    const [row] = await query(
      `INSERT INTO inference_logs (model_id, input_data, prediction, confidence, embedding)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        model_id,
        JSON.stringify(input_data),
        JSON.stringify(prediction),
        confidence,
        embedding || null,
      ]
    );

    res.json({ success: true, inference: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/drift/latest", async (req, res) => {
  try {
    const modelId = req.query.model_id || DEFAULT_MODEL_ID;

    const [drift] = await query(
      `SELECT * FROM drift_runs WHERE model_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [modelId]
    );

    if (!drift) {
      return res.json({ status: "no_data", message: "No drift runs found" });
    }

    res.json({
      status: drift.drift_detected ? "drift_detected" : "stable",
      metrics: {
        kl_divergence: drift.kl_divergence,
        cosine_similarity: drift.cosine_similarity,
        drift_detected: drift.drift_detected,
      },
      window: { start: drift.window_start, end: drift.window_end },
      created_at: drift.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/drift/history", async (req, res) => {
  try {
    const { model_id = DEFAULT_MODEL_ID, limit = 50 } = req.query;

    const rows = await query(
      `SELECT * FROM drift_runs WHERE model_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [model_id, limit]
    );

    res.json(rows.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/alerts", async (req, res) => {
  try {
    const { model_id, limit = 20 } = req.query;

    let sql = `SELECT a.*, m.name as model_name FROM alerts a JOIN models m ON a.model_id = m.id`;
    const params = [];

    if (model_id) {
      sql += ` WHERE a.model_id = $1`;
      params.push(model_id);
    }

    sql += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    res.json(await query(sql, params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/models", async (req, res) => {
  try {
    res.json(await query("SELECT * FROM models ORDER BY created_at DESC"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/stats", async (req, res) => {
  try {
    const [[inferences], [driftRuns], [alerts]] = await Promise.all([
      query("SELECT COUNT(*)::int as count FROM inference_logs"),
      query("SELECT COUNT(*)::int as count FROM drift_runs"),
      query(
        "SELECT COUNT(*)::int as count FROM alerts WHERE acknowledged = false"
      ),
    ]);

    res.json({
      total_inferences: inferences.count,
      total_drift_runs: driftRuns.count,
      unacknowledged_alerts: alerts.count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
