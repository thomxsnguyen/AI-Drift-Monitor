"""Drift computation service for ML model monitoring."""

import os
from datetime import datetime
from contextlib import contextmanager

import numpy as np
from scipy.stats import entropy
from scipy.spatial.distance import cosine
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor


app = FastAPI(title="Drift Service")

DATABASE_URL = os.environ.get("DATABASE_URL")

# Drift detection thresholds
KL_THRESHOLD = 0.1
COSINE_THRESHOLD = 0.9
MIN_SAMPLES = 5
HISTOGRAM_BINS = 10


class DriftRequest(BaseModel):
    model_id: int = 1
    window_minutes: int = 60
    baseline_minutes: int = 1440


class DriftResponse(BaseModel):
    kl_divergence: float
    cosine_similarity: float
    drift_detected: bool
    window_start: datetime
    window_end: datetime
    sample_count: int
    baseline_count: int


@contextmanager
def get_db():
    """Database connection context manager."""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        yield conn.cursor()
    finally:
        conn.close()


def to_distribution(values: np.ndarray) -> np.ndarray:
    """Convert values to normalized probability distribution."""
    if len(values) == 0:
        return np.ones(HISTOGRAM_BINS) / HISTOGRAM_BINS
    
    hist, _ = np.histogram(values, bins=HISTOGRAM_BINS, range=(0, 1), density=True)
    hist = hist + 1e-10
    return hist / hist.sum()


def kl_divergence(p: np.ndarray, q: np.ndarray) -> float:
    """Compute KL divergence D(P||Q)."""
    return float(entropy(p, q))


def cosine_similarity(p: np.ndarray, q: np.ndarray) -> float:
    """Compute cosine similarity between distributions."""
    return float(1 - cosine(p, q))


def fetch_confidence_values(cursor, model_id: int, start_interval: int, end_interval: int = 0):
    """Fetch confidence values within a time window."""
    cursor.execute("""
        SELECT confidence FROM inference_logs 
        WHERE model_id = %s 
          AND created_at > NOW() - INTERVAL '%s minutes'
          AND created_at <= NOW() - INTERVAL '%s minutes'
    """, (model_id, start_interval, end_interval))
    
    return np.array([
        row['confidence'] if row['confidence'] is not None else 0.5 
        for row in cursor.fetchall()
    ])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/compute_drift", response_model=DriftResponse)
def compute_drift(req: DriftRequest):
    """Compute drift metrics comparing recent data to baseline."""
    try:
        with get_db() as cursor:
            recent = fetch_confidence_values(cursor, req.model_id, req.window_minutes, 0)
            baseline = fetch_confidence_values(cursor, req.model_id, req.baseline_minutes, req.window_minutes)
        
        now = datetime.now()
        
        # Insufficient data
        if len(recent) < MIN_SAMPLES:
            return DriftResponse(
                kl_divergence=0.0,
                cosine_similarity=1.0,
                drift_detected=False,
                window_start=now,
                window_end=now,
                sample_count=len(recent),
                baseline_count=len(baseline),
            )
        
        # No baseline available
        if len(baseline) < MIN_SAMPLES:
            baseline = recent
        
        p = to_distribution(baseline)
        q = to_distribution(recent)
        
        kl = kl_divergence(p, q)
        cos = cosine_similarity(p, q)
        
        return DriftResponse(
            kl_divergence=round(kl, 6),
            cosine_similarity=round(cos, 6),
            drift_detected=(kl > KL_THRESHOLD or cos < COSINE_THRESHOLD),
            window_start=now,
            window_end=now,
            sample_count=len(recent),
            baseline_count=len(baseline),
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
