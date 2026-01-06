.PHONY: help build up down restart logs clean test install

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build all Docker images
	docker-compose build

up: ## Start all services
	docker-compose up -d
	@echo "Services started. API: http://localhost:3000, Auditor: http://localhost:8000"

down: ## Stop all services
	docker-compose down

restart: ## Restart all services
	docker-compose restart

logs: ## View logs from all services
	docker-compose logs -f

logs-api: ## View API logs
	docker-compose logs -f api

logs-auditor: ## View Auditor logs
	docker-compose logs -f auditor

logs-db: ## View database logs
	docker-compose logs -f postgres

clean: ## Remove all containers, volumes, and images
	docker-compose down -v
	docker-compose rm -f

test-api: ## Test API endpoints
	@echo "Testing API health..."
	curl -s http://localhost:3000/health | jq .
	@echo "\nTesting drift calculation..."
	curl -s -X POST http://localhost:3000/api/drift/calculate \
		-H "Content-Type: application/json" \
		-d '{"baseline":[1,2,3,4,5],"current":[1.1,2.2,3.1,4.2,5.1],"modelId":"test-model"}' | jq .

test-auditor: ## Test Auditor endpoints
	@echo "Testing Auditor health..."
	curl -s http://localhost:8000/health | jq .
	@echo "\nListing models..."
	curl -s http://localhost:8000/models | jq .

install: ## Install dependencies for local development
	cd services/api && npm install
	cd services/auditor && pip install -r requirements.txt

dev-api: ## Run API in development mode
	cd services/api && npm run dev

dev-auditor: ## Run Auditor in development mode
	cd services/auditor && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

migrate: ## Run database migrations
	@echo "Running migrations..."
	docker-compose exec postgres psql -U driftuser -d driftmonitor -f /docker-entrypoint-initdb.d/../migrations/001_add_alert_config.sql

status: ## Show status of all services
	docker-compose ps
