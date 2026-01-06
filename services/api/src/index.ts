import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { Pool } from 'pg';
import { driftRouter } from './routes/drift';
import { ingestData } from './services/ingestion';
import { getDatabasePool } from './config/database';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'ai-drift-monitor-api' });
});

// Drift metrics endpoints
app.use('/api/drift', driftRouter);

// Initialize database pool
const pool = getDatabasePool();

// Cron job for data ingestion (runs every hour)
const cronSchedule = process.env.CRON_SCHEDULE || '0 * * * *';
cron.schedule(cronSchedule, async () => {
  console.log(`[${new Date().toISOString()}] Running scheduled data ingestion`);
  try {
    await ingestData(pool);
    console.log('Data ingestion completed successfully');
  } catch (error) {
    console.error('Error during data ingestion:', error);
  }
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
  console.log(`⏰[cron]: Scheduled ingestion at: ${cronSchedule}`);
});

export { app, pool };
