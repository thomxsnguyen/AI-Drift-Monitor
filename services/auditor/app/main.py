from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import numpy as np
from datetime import datetime
import os
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI(title="AI Drift Auditor", version="1.0.0")

# Database connection parameters
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'postgres'),
    'port': int(os.getenv('DB_PORT', '5432')),
    'database': os.getenv('DB_NAME', 'driftmonitor'),
    'user': os.getenv('DB_USER', 'driftuser'),
    'password': os.getenv('DB_PASSWORD', 'driftpass'),
}


class DriftMetrics(BaseModel):
    model_id: str
    cosine_distance: float
    kl_divergence: float


class AdaptiveThreshold(BaseModel):
    model_id: str
    cosine_threshold: Optional[float] = None
    kl_threshold: Optional[float] = None


class AuditResult(BaseModel):
    model_id: str
    status: str
    drift_detected: bool
    cosine_distance: float
    kl_divergence: float
    cosine_threshold: float
    kl_threshold: float
    recommendation: str


def get_db_connection():
    """Create a database connection"""
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)


def calculate_adaptive_threshold(values: List[float], sensitivity: float = 2.0) -> float:
    """
    Calculate adaptive threshold using mean + sensitivity * std deviation
    """
    if not values:
        return 0.5  # Default threshold
    
    arr = np.array(values)
    mean = np.mean(arr)
    std = np.std(arr)
    
    threshold = mean + (sensitivity * std)
    return float(threshold)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "ai-drift-auditor"}


@app.post("/audit", response_model=AuditResult)
async def audit_drift(metrics: DriftMetrics):
    """
    Audit drift metrics against adaptive thresholds
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Fetch historical metrics for this model
        cur.execute(
            """
            SELECT cosine_distance, kl_divergence 
            FROM drift_metrics 
            WHERE model_id = %s 
            ORDER BY created_at DESC 
            LIMIT 100
            """,
            (metrics.model_id,)
        )
        
        historical = cur.fetchall()
        
        # Calculate adaptive thresholds
        if historical:
            cosine_values = [row['cosine_distance'] for row in historical]
            kl_values = [row['kl_divergence'] for row in historical]
            
            cosine_threshold = calculate_adaptive_threshold(cosine_values)
            kl_threshold = calculate_adaptive_threshold(kl_values)
        else:
            # Default thresholds for new models
            cosine_threshold = 0.3
            kl_threshold = 0.5
        
        # Store adaptive thresholds
        cur.execute(
            """
            INSERT INTO adaptive_thresholds (model_id, cosine_threshold, kl_threshold)
            VALUES (%s, %s, %s)
            ON CONFLICT (model_id) 
            DO UPDATE SET 
                cosine_threshold = EXCLUDED.cosine_threshold,
                kl_threshold = EXCLUDED.kl_threshold,
                updated_at = CURRENT_TIMESTAMP
            """,
            (metrics.model_id, cosine_threshold, kl_threshold)
        )
        
        conn.commit()
        
        # Determine if drift is detected
        cosine_drift = metrics.cosine_distance > cosine_threshold
        kl_drift = metrics.kl_divergence > kl_threshold
        drift_detected = cosine_drift or kl_drift
        
        # Generate recommendation
        if drift_detected:
            if cosine_drift and kl_drift:
                status = "critical"
                recommendation = "Significant drift detected in both metrics. Recommend model retraining."
            elif cosine_drift:
                status = "warning"
                recommendation = "Cosine distance indicates feature distribution shift. Monitor closely."
            else:
                status = "warning"
                recommendation = "KL divergence indicates probability distribution shift. Review model performance."
        else:
            status = "healthy"
            recommendation = "No significant drift detected. Model operating within normal parameters."
        
        cur.close()
        conn.close()
        
        return AuditResult(
            model_id=metrics.model_id,
            status=status,
            drift_detected=drift_detected,
            cosine_distance=metrics.cosine_distance,
            kl_divergence=metrics.kl_divergence,
            cosine_threshold=cosine_threshold,
            kl_threshold=kl_threshold,
            recommendation=recommendation
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit failed: {str(e)}")


@app.get("/thresholds/{model_id}")
async def get_thresholds(model_id: str):
    """
    Get current adaptive thresholds for a model
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(
            "SELECT * FROM adaptive_thresholds WHERE model_id = %s",
            (model_id,)
        )
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="Model thresholds not found")
        
        return dict(result)
        
    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/models")
async def list_models():
    """
    List all models with drift metrics
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(
            """
            SELECT 
                model_id,
                COUNT(*) as metric_count,
                MAX(created_at) as last_updated
            FROM drift_metrics
            GROUP BY model_id
            ORDER BY last_updated DESC
            """
        )
        
        results = cur.fetchall()
        cur.close()
        conn.close()
        
        return {"models": [dict(row) for row in results]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list models: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
