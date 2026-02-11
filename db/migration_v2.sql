-- Migration script to add embeddings and adaptive thresholding to existing databases
-- Run this if you already have an existing AI-Drift-Monitor database

-- Add embedding column to inference_logs
ALTER TABLE inference_logs 
ADD COLUMN IF NOT EXISTS embedding FLOAT ARRAY;

-- Add embedding_drift column to drift_runs
ALTER TABLE drift_runs 
ADD COLUMN IF NOT EXISTS embedding_drift FLOAT;

-- Create threshold_history table
CREATE TABLE IF NOT EXISTS threshold_history (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES models(id),
    metric_name VARCHAR(50) NOT NULL,
    threshold_value FLOAT NOT NULL,
    sample_count INTEGER,
    mean_value FLOAT,
    std_value FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_threshold_history_model_id ON threshold_history(model_id);
CREATE INDEX IF NOT EXISTS idx_threshold_history_metric ON threshold_history(metric_name);

-- Display migration status
SELECT 'Migration completed successfully' AS status;
