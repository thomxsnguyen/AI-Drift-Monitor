"""Drift computation service for ML model monitoring."""

import os
from datetime import datetime
from contextlib import contextmanager
from typing import List, Optional, Tuple

import numpy as np
from scipy.stats import entropy
from scipy.spatial.distance import cosine
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor


app = FastAPI(title="Drift Service")

DATABASE_URL = os.environ.get("DATABASE_URL")

# Base thresholds (will be adapted)
BASE_KL_THRESHOLD = 0.1
BASE_COSINE_THRESHOLD = 0.9
BASE_EMBEDDING_THRESHOLD = 0.15
MIN_SAMPLES = 5
HISTOGRAM_BINS = 10

# Adaptive threshold parameters
ADAPTIVE_WINDOW_SIZE = 100  # Use last N drift runs to adapt
ADAPTIVE_STD_MULTIPLIER = 2.0  # Threshold = mean + (std * multiplier)
MIN_ADAPTIVE_SAMPLES = 10  # Minimum runs before adapting


class DriftRequest(BaseModel):
    model_id: int = 1
    window_minutes: int = 60
    baseline_minutes: int = 1440


class DriftResponse(BaseModel):
    kl_divergence: float
    cosine_similarity: float
    embedding_drift: Optional[float]
    drift_detected: bool
    window_start: datetime
    window_end: datetime
    sample_count: int
    baseline_count: int
    thresholds: dict


@contextmanager
def get_db():
    """Database connection context manager."""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        cursor = conn.cursor()
        yield cursor, conn
        conn.commit()
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


def embedding_distance(embeddings_baseline: List[np.ndarray], embeddings_recent: List[np.ndarray]) -> float:
    """Compute mean cosine distance between embedding sets."""
    if not embeddings_baseline or not embeddings_recent:
        return 0.0
    
    # Compute mean embedding for each set
    mean_baseline = np.mean(embeddings_baseline, axis=0)
    mean_recent = np.mean(embeddings_recent, axis=0)
    
    # Return cosine distance (1 - cosine similarity)
    return float(cosine(mean_baseline, mean_recent))


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


def fetch_embeddings(cursor, model_id: int, start_interval: int, end_interval: int = 0) -> List[np.ndarray]:
    """Fetch embeddings within a time window."""
    cursor.execute("""
        SELECT embedding FROM inference_logs 
        WHERE model_id = %s 
          AND embedding IS NOT NULL
          AND created_at > NOW() - INTERVAL '%s minutes'
          AND created_at <= NOW() - INTERVAL '%s minutes'
    """, (model_id, start_interval, end_interval))
    
    embeddings = []
    for row in cursor.fetchall():
        if row['embedding']:
            embeddings.append(np.array(row['embedding']))
    return embeddings


def compute_adaptive_thresholds(cursor, model_id: int) -> Tuple[float, float, float]:
    """
    Compute adaptive thresholds based on historical drift metrics.
    Returns: (kl_threshold, cosine_threshold, embedding_threshold)
    """
    cursor.execute("""
        SELECT kl_divergence, cosine_similarity, embedding_drift 
        FROM drift_runs 
        WHERE model_id = %s 
          AND drift_detected = false
        ORDER BY created_at DESC 
        LIMIT %s
    """, (model_id, ADAPTIVE_WINDOW_SIZE))
    
    rows = cursor.fetchall()
    
    if len(rows) < MIN_ADAPTIVE_SAMPLES:
        # Not enough history, use base thresholds
        return BASE_KL_THRESHOLD, BASE_COSINE_THRESHOLD, BASE_EMBEDDING_THRESHOLD
    
    # Extract metrics
    kl_values = [r['kl_divergence'] for r in rows if r['kl_divergence'] is not None]
    cosine_values = [r['cosine_similarity'] for r in rows if r['cosine_similarity'] is not None]
    embedding_values = [r['embedding_drift'] for r in rows if r['embedding_drift'] is not None]
    
    # Compute adaptive thresholds: mean + (std * multiplier)
    kl_threshold = BASE_KL_THRESHOLD
    if kl_values:
        kl_mean = np.mean(kl_values)
        kl_std = np.std(kl_values)
        kl_threshold = kl_mean + (kl_std * ADAPTIVE_STD_MULTIPLIER)
        kl_threshold = max(kl_threshold, BASE_KL_THRESHOLD)  # Don't go below base
    
    cosine_threshold = BASE_COSINE_THRESHOLD
    if cosine_values:
        cosine_mean = np.mean(cosine_values)
        cosine_std = np.std(cosine_values)
        cosine_threshold = cosine_mean - (cosine_std * ADAPTIVE_STD_MULTIPLIER)
        cosine_threshold = min(cosine_threshold, BASE_COSINE_THRESHOLD)  # Don't go above base
    
    embedding_threshold = BASE_EMBEDDING_THRESHOLD
    if embedding_values:
        emb_mean = np.mean(embedding_values)
        emb_std = np.std(embedding_values)
        embedding_threshold = emb_mean + (emb_std * ADAPTIVE_STD_MULTIPLIER)
        embedding_threshold = max(embedding_threshold, BASE_EMBEDDING_THRESHOLD)
    
    return kl_threshold, cosine_threshold, embedding_threshold


def store_threshold_history(cursor, model_id: int, metric_name: str, threshold: float, 
                           sample_count: int, mean_val: float, std_val: float):
    """Store threshold calculation history for auditing."""
    cursor.execute("""
        INSERT INTO threshold_history 
        (model_id, metric_name, threshold_value, sample_count, mean_value, std_value)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (model_id, metric_name, threshold, sample_count, mean_val, std_val))


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/compute_drift", response_model=DriftResponse)
def compute_drift(req: DriftRequest):
    """Compute drift metrics comparing recent data to baseline with adaptive thresholds."""
    try:
        with get_db() as (cursor, conn):
            # Fetch confidence distributions
            recent_conf = fetch_confidence_values(cursor, req.model_id, req.window_minutes, 0)
            baseline_conf = fetch_confidence_values(cursor, req.model_id, req.baseline_minutes, req.window_minutes)
            
            # Fetch embeddings
            recent_emb = fetch_embeddings(cursor, req.model_id, req.window_minutes, 0)
            baseline_emb = fetch_embeddings(cursor, req.model_id, req.baseline_minutes, req.window_minutes)
            
            now = datetime.now()
            
            # Insufficient data
            if len(recent_conf) < MIN_SAMPLES:
                return DriftResponse(
                    kl_divergence=0.0,
                    cosine_similarity=1.0,
                    embedding_drift=None,
                    drift_detected=False,
                    window_start=now,
                    window_end=now,
                    sample_count=len(recent_conf),
                    baseline_count=len(baseline_conf),
                    thresholds={"kl": BASE_KL_THRESHOLD, "cosine": BASE_COSINE_THRESHOLD, 
                               "embedding": BASE_EMBEDDING_THRESHOLD},
                )
            
            # No baseline available
            if len(baseline_conf) < MIN_SAMPLES:
                baseline_conf = recent_conf
            
            # Compute adaptive thresholds
            kl_thresh, cosine_thresh, emb_thresh = compute_adaptive_thresholds(cursor, req.model_id)
            
            # Confidence-based drift
            p = to_distribution(baseline_conf)
            q = to_distribution(recent_conf)
            kl = kl_divergence(p, q)
            cos = cosine_similarity(p, q)
            
            # Embedding-based drift
            emb_drift = None
            if recent_emb and baseline_emb:
                emb_drift = embedding_distance(baseline_emb, recent_emb)
            
            # Detect drift using adaptive thresholds
            drift_detected = (kl > kl_thresh or cos < cosine_thresh)
            if emb_drift is not None:
                drift_detected = drift_detected or (emb_drift > emb_thresh)
            
            # Store threshold history for auditing
            store_threshold_history(cursor, req.model_id, "kl_divergence", kl_thresh, 
                                  len(baseline_conf), np.mean([kl]), 0.0)
            store_threshold_history(cursor, req.model_id, "cosine_similarity", cosine_thresh,
                                  len(baseline_conf), np.mean([cos]), 0.0)
            if emb_drift is not None:
                store_threshold_history(cursor, req.model_id, "embedding_drift", emb_thresh,
                                      len(baseline_emb), emb_drift, 0.0)
            
            return DriftResponse(
                kl_divergence=round(kl, 6),
                cosine_similarity=round(cos, 6),
                embedding_drift=round(emb_drift, 6) if emb_drift is not None else None,
                drift_detected=drift_detected,
                window_start=now,
                window_end=now,
                sample_count=len(recent_conf),
                baseline_count=len(baseline_conf),
                thresholds={
                    "kl": round(kl_thresh, 6),
                    "cosine": round(cosine_thresh, 6),
                    "embedding": round(emb_thresh, 6)
                },
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

