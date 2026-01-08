const cron = require("node-cron");
const axios = require("axios");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://python-service:8000";

const DRIFT_CONFIG = {
  windowMinutes: 60,
  baselineMinutes: 1440,
  criticalThreshold: 0.5,
  cronSchedule: "*/5 * * * *",
};

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function computeDrift(modelId) {
  const response = await axios.post(`${PYTHON_SERVICE_URL}/compute_drift`, {
    model_id: modelId,
    window_minutes: DRIFT_CONFIG.windowMinutes,
    baseline_minutes: DRIFT_CONFIG.baselineMinutes,
  });
  return response.data;
}

async function storeDriftRun(modelId, drift) {
  const [row] = await query(
    `INSERT INTO drift_runs (model_id, window_start, window_end, kl_divergence, cosine_similarity, drift_detected)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      modelId,
      drift.window_start,
      drift.window_end,
      drift.kl_divergence,
      drift.cosine_similarity,
      drift.drift_detected,
    ]
  );
  return row.id;
}

async function createAlert(modelId, driftRunId, drift, modelName) {
  const severity =
    drift.kl_divergence > DRIFT_CONFIG.criticalThreshold
      ? "critical"
      : "warning";
  const message = `Drift detected: ${modelName} (KL=${drift.kl_divergence.toFixed(
    4
  )}, cosine=${drift.cosine_similarity.toFixed(4)})`;

  await query(
    `INSERT INTO alerts (model_id, drift_run_id, severity, message) VALUES ($1, $2, $3, $4)`,
    [modelId, driftRunId, severity, message]
  );

  console.log(`[ALERT] ${severity}: ${message}`);
}

async function checkModel(model) {
  const drift = await computeDrift(model.id);
  console.log(
    `[${model.name}] KL=${drift.kl_divergence.toFixed(
      4
    )} cosine=${drift.cosine_similarity.toFixed(4)} drift=${
      drift.drift_detected
    }`
  );

  const driftRunId = await storeDriftRun(model.id, drift);

  if (drift.drift_detected) {
    await createAlert(model.id, driftRunId, drift, model.name);
  }
}

async function runDriftCheck() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting drift check`);

  try {
    const models = await query("SELECT id, name FROM models");

    for (const model of models) {
      await checkModel(model);
    }

    console.log(`[${timestamp}] Drift check complete`);
  } catch (err) {
    console.error(`[${timestamp}] Error:`, err.message);
  }
}

async function waitForServices(maxRetries = 30, delayMs = 2000) {
  console.log("Waiting for services...");

  for (let i = maxRetries; i > 0; i--) {
    try {
      await axios.get(`${PYTHON_SERVICE_URL}/health`);
      await pool.query("SELECT 1");
      console.log("Services ready");
      return;
    } catch {
      console.log(`Retrying... (${i - 1} attempts left)`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw new Error("Services unavailable");
}

async function main() {
  await waitForServices();
  await runDriftCheck();

  cron.schedule(DRIFT_CONFIG.cronSchedule, runDriftCheck);
  console.log(`Worker running (schedule: ${DRIFT_CONFIG.cronSchedule})`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
