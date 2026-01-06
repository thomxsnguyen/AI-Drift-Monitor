# AI Drift Monitor

A comprehensive monorepo for monitoring AI/ML model drift using multiple metrics and adaptive thresholds.

## 🏗️ Architecture

This monorerepo includes:

- **services/api** - Node.js + TypeScript + Express API for drift metrics calculation and storage
  - Cron-based data ingestion
  - Cosine distance and KL divergence metrics
  - PostgreSQL integration
  
- **services/auditor** - Python FastAPI microservice for drift auditing
  - Adaptive threshold calculation
  - Model health assessment
  - Drift detection and recommendations

- **postgres** - PostgreSQL database with initialization scripts and migrations

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Make (optional, for convenience commands)
- Node.js 20+ and Python 3.11+ (for local development)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AI-Drift-Monitor
   ```

2. **Copy environment file**
   ```bash
   cp .env.example .env
   ```

3. **Start all services**
   ```bash
   make up
   # or
   docker-compose up -d
   ```

4. **Verify services are running**
   ```bash
   make status
   # or
   docker-compose ps
   ```

Services will be available at:
- API: http://localhost:3000
- Auditor: http://localhost:8000
- PostgreSQL: localhost:5432

## 📡 API Endpoints

### API Service (port 3000)

#### Health Check
```bash
GET /health
```

#### Calculate Drift Metrics
```bash
POST /api/drift/calculate
Content-Type: application/json

{
  "baseline": [1, 2, 3, 4, 5],
  "current": [1.1, 2.2, 3.1, 4.2, 5.1],
  "modelId": "my-model"
}
```

**Response:**
```json
{
  "success": true,
  "metrics": {
    "cosineDistance": 0.0234,
    "cosineSimilarity": 0.9766,
    "klDivergence": 0.0456
  },
  "stored": {
    "id": 1,
    "model_id": "my-model",
    "cosine_distance": 0.0234,
    "kl_divergence": 0.0456,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### Get All Drift Metrics
```bash
GET /api/drift/metrics
```

#### Get Drift Metrics by Model
```bash
GET /api/drift/metrics/:modelId
```

### Auditor Service (port 8000)

#### Health Check
```bash
GET /health
```

#### Audit Drift Metrics
```bash
POST /audit
Content-Type: application/json

{
  "model_id": "my-model",
  "cosine_distance": 0.45,
  "kl_divergence": 0.67
}
```

**Response:**
```json
{
  "model_id": "my-model",
  "status": "warning",
  "drift_detected": true,
  "cosine_distance": 0.45,
  "kl_divergence": 0.67,
  "cosine_threshold": 0.35,
  "kl_threshold": 0.55,
  "recommendation": "KL divergence indicates probability distribution shift. Review model performance."
}
```

#### Get Adaptive Thresholds
```bash
GET /thresholds/:modelId
```

#### List All Models
```bash
GET /models
```

## 🛠️ Development

### Local Development (without Docker)

#### API Service
```bash
cd services/api
npm install
npm run dev
```

#### Auditor Service
```bash
cd services/auditor
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Build Services
```bash
make build
# or
docker-compose build
```

### View Logs
```bash
make logs        # All services
make logs-api    # API only
make logs-auditor # Auditor only
make logs-db     # Database only
```

### Run Tests
```bash
make test-api      # Test API endpoints
make test-auditor  # Test Auditor endpoints
```

### Database Migrations
```bash
make migrate
```

## 📊 Drift Metrics Explained

### Cosine Distance
- Measures the angle between two vectors
- Range: 0-2 (where 0 = identical, 2 = opposite)
- Useful for detecting changes in feature distributions
- Calculated as: `1 - cosine_similarity`

### KL Divergence (Kullback-Leibler)
- Measures how one probability distribution differs from another
- Range: 0-∞ (where 0 = identical distributions)
- Useful for detecting distribution shifts
- Formula: `KL(P||Q) = Σ P(i) * log(P(i) / Q(i))`

## 🎯 Adaptive Thresholds

The auditor service automatically calculates adaptive thresholds based on historical data:

- **Method**: `mean + (sensitivity * standard_deviation)`
- **Default sensitivity**: 2.0
- **Updates**: Automatically updated with each audit
- **Benefits**: Adapts to model-specific behavior patterns

## 🔄 Cron Ingestion

The API service includes a cron job for automated data ingestion:

- **Default schedule**: Every hour (`0 * * * *`)
- **Configurable**: Set `CRON_SCHEDULE` in `.env`
- **Purpose**: Automatically fetch and analyze model data

## 🐳 Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Rebuild and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Remove all data
docker-compose down -v
```

## 📁 Project Structure

```
AI-Drift-Monitor/
├── services/
│   ├── api/                    # Node.js + TypeScript + Express
│   │   ├── src/
│   │   │   ├── config/        # Database configuration
│   │   │   ├── routes/        # API routes
│   │   │   ├── services/      # Business logic
│   │   │   ├── utils/         # Utility functions
│   │   │   └── index.ts       # Entry point
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── auditor/               # Python + FastAPI
│       ├── app/
│       │   └── main.py        # FastAPI application
│       ├── Dockerfile
│       └── requirements.txt
├── postgres/
│   ├── init/                  # Initialization scripts
│   │   └── 01-init.sql
│   └── migrations/            # Database migrations
│       └── 001_add_alert_config.sql
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI
├── docker-compose.yml
├── Makefile
├── .env.example
└── README.md
```

## 🧪 Testing

### Manual Testing with curl

```bash
# Test API health
curl http://localhost:3000/health

# Calculate drift
curl -X POST http://localhost:3000/api/drift/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "baseline": [1, 2, 3, 4, 5],
    "current": [1.1, 2.2, 3.1, 4.2, 5.1],
    "modelId": "test-model"
  }'

# Get drift metrics
curl http://localhost:3000/api/drift/metrics

# Test auditor health
curl http://localhost:8000/health

# Audit drift
curl -X POST http://localhost:8000/audit \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "test-model",
    "cosine_distance": 0.25,
    "kl_divergence": 0.35
  }'

# List models
curl http://localhost:8000/models
```

## 🔧 Configuration

### Environment Variables

See `.env.example` for all available configuration options:

- `DB_NAME` - Database name (default: driftmonitor)
- `DB_USER` - Database user (default: driftuser)
- `DB_PASSWORD` - Database password (default: driftpass)
- `API_PORT` - API service port (default: 3000)
- `AUDITOR_PORT` - Auditor service port (default: 8000)
- `CRON_SCHEDULE` - Cron schedule for ingestion (default: "0 * * * *")

## 🚦 CI/CD

GitHub Actions workflow included:

1. **Lint & Build** - Lints and builds both services
2. **Docker Build** - Builds Docker images
3. **Integration Tests** - Tests services with docker-compose

## 📝 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request