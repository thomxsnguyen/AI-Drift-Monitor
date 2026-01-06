-- Initialize database schema for AI Drift Monitor

-- Create drift_metrics table
CREATE TABLE IF NOT EXISTS drift_metrics (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(255) NOT NULL,
    cosine_distance DOUBLE PRECISION NOT NULL,
    kl_divergence DOUBLE PRECISION NOT NULL,
    baseline_distribution JSONB,
    current_distribution JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create adaptive_thresholds table
CREATE TABLE IF NOT EXISTS adaptive_thresholds (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(255) UNIQUE NOT NULL,
    cosine_threshold DOUBLE PRECISION,
    kl_threshold DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_drift_metrics_model_id ON drift_metrics(model_id);
CREATE INDEX idx_drift_metrics_created_at ON drift_metrics(created_at DESC);
CREATE INDEX idx_adaptive_thresholds_model_id ON adaptive_thresholds(model_id);

-- Insert sample data (optional, for testing)
INSERT INTO drift_metrics (model_id, cosine_distance, kl_divergence, baseline_distribution, current_distribution)
VALUES 
    ('sample-model-1', 0.15, 0.25, '[1, 2, 3, 4, 5]'::jsonb, '[1.1, 2.2, 3.1, 4.2, 5.1]'::jsonb),
    ('sample-model-1', 0.18, 0.30, '[1, 2, 3, 4, 5]'::jsonb, '[1.2, 2.3, 3.2, 4.3, 5.2]'::jsonb);
