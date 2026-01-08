-- Models table
CREATE TABLE models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Inference logs table
CREATE TABLE inference_logs (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES models(id),
    input_data JSONB NOT NULL,
    prediction JSONB NOT NULL,
    confidence FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Drift runs table
CREATE TABLE drift_runs (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES models(id),
    window_start TIMESTAMP NOT NULL,
    window_end TIMESTAMP NOT NULL,
    kl_divergence FLOAT,
    cosine_similarity FLOAT,
    drift_detected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Alerts table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES models(id),
    drift_run_id INTEGER REFERENCES drift_runs(id),
    severity VARCHAR(50) DEFAULT 'warning',
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert a default model
INSERT INTO models (name, description) VALUES ('default-model', 'Default ML model for testing');

-- Create indexes for performance
CREATE INDEX idx_inference_logs_model_id ON inference_logs(model_id);
CREATE INDEX idx_inference_logs_created_at ON inference_logs(created_at);
CREATE INDEX idx_drift_runs_model_id ON drift_runs(model_id);
CREATE INDEX idx_alerts_model_id ON alerts(model_id);
