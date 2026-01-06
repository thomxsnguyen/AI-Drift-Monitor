import { Pool } from 'pg';

export function getDatabasePool(): Pool {
  const pool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'driftmonitor',
    user: process.env.DB_USER || 'driftuser',
    password: process.env.DB_PASSWORD || 'driftpass',
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  return pool;
}
