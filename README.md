# AI Drift Monitor

A complete production-ready ML drift detection system with 5 core components:

```
Ingest → Store → Compute Drift → Alert → Visualize
```

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Your ML App   │────▶│   API (Node) │────▶│   PostgreSQL    │
│  POST /inference│     │   :3001      │     │   :5432         │
└─────────────────┘     └──────────────┘     └─────────────────┘
                                                      │
                        ┌──────────────┐              │
                        │   Worker     │──────────────┤
                        │   (Cron)     │              │
                        └──────┬───────┘              │
                               │                      │
                        ┌──────▼───────┐              │
                        │ Python Drift │──────────────┘
                        │   :8000      │
                        └──────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Dashboard (Next.js) :3000                │
│  • Drift scores over time    • Alert feed                   │
│  • KL Divergence chart       • Cosine Similarity chart      │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start all services

```bash
docker-compose up --build
```

### 2. Wait for services to be ready (~30 seconds)

- API: http://localhost:3001
- Dashboard: http://localhost:3000
- Python Service: http://localhost:8000

### 3. Generate sample data

```bash
chmod +x scripts/generate-data.sh
./scripts/generate-data.sh
```

### 4. View the dashboard

Open http://localhost:3000 to see drift metrics and alerts!

## API Endpoints

### Log an inference

```bash
curl -X POST http://localhost:3001/inference \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": 1,
    "input_data": {"feature1": 0.5, "feature2": 0.3},
    "prediction": {"class": "positive", "score": 0.92},
    "confidence": 0.92
  }'
```

### Get latest drift metrics

```bash
curl http://localhost:3001/drift/latest
```

### Get drift history

```bash
curl http://localhost:3001/drift/history
```

### Get alerts

```bash
curl http://localhost:3001/alerts
```

### Get stats

```bash
curl http://localhost:3001/stats
```

## Drift Detection

The system computes two metrics:

1. **KL Divergence** - Measures how different the recent prediction distribution is from the baseline

   - Threshold: > 0.1 indicates drift

2. **Cosine Similarity** - Measures the angle between distribution vectors
   - Threshold: < 0.9 indicates drift

The worker runs every 5 minutes, comparing:

- **Recent window**: Last 60 minutes of predictions
- **Baseline**: Previous 24 hours of predictions

## Database Schema

- `models` - Registered ML models
- `inference_logs` - All logged predictions with metadata
- `drift_runs` - Historical drift computation results
- `alerts` - Generated alerts when drift is detected

## Services

| Service        | Port | Description                               |
| -------------- | ---- | ----------------------------------------- |
| API            | 3001 | Node/Express API for logging inferences   |
| Python Service | 8000 | FastAPI service for drift computation     |
| Worker         | -    | Cron job running drift checks every 5 min |
| Dashboard      | 3000 | Next.js visualization dashboard           |
| PostgreSQL     | 5432 | Database storage                          |

## Development

### Run services individually

```bash
# Database only
docker-compose up postgres

# API
cd api && npm install && npm run dev

# Python service
cd python-service && pip install -r requirements.txt && uvicorn main:app --reload

# Worker
cd worker && npm install && npm start

# Dashboard
cd dashboard && npm install && npm run dev
```

## Tech Stack

- **API**: Node.js, Express, pg
- **Drift Computation**: Python, FastAPI, NumPy, SciPy
- **Database**: PostgreSQL
- **Dashboard**: Next.js, React, Recharts
- **Worker**: Node.js, node-cron
- **Infrastructure**: Docker, Docker Compose
