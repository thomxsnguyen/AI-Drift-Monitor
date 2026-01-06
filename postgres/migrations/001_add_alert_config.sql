-- Migration: Add alert configuration table
-- Date: 2024-01-01

CREATE TABLE IF NOT EXISTS alert_config (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(255) NOT NULL,
    alert_enabled BOOLEAN DEFAULT true,
    notification_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(model_id)
);

CREATE INDEX idx_alert_config_model_id ON alert_config(model_id);
