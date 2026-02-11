#!/bin/bash
# Quick validation script for adaptive thresholding and embeddings

set -e

API_URL="${1:-http://localhost:3001}"

echo "🧪 Testing AI Drift Monitor - Adaptive Thresholding & Embeddings"
echo "================================================================="
echo ""

# Test 1: API Health
echo "✓ Test 1: API Health Check"
curl -s "$API_URL/health" | grep -q "ok" && echo "  ✅ API is healthy" || echo "  ❌ API is down"
echo ""

# Test 2: Inference without embedding (backward compatibility)
echo "✓ Test 2: Inference without embedding"
response=$(curl -s -X POST "$API_URL/inference" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": 1,
    "input_data": {"test": true},
    "prediction": {"class": "A"},
    "confidence": 0.85
  }')
echo "$response" | grep -q "success" && echo "  ✅ Basic inference works" || echo "  ❌ Failed"
echo ""

# Test 3: Inference with embedding
echo "✓ Test 3: Inference with embedding"
response=$(curl -s -X POST "$API_URL/inference" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": 1,
    "input_data": {"test": true},
    "prediction": {"class": "B"},
    "confidence": 0.92,
    "embedding": [0.1, 0.2, 0.3, 0.4, 0.5]
  }')
echo "$response" | grep -q "success" && echo "  ✅ Embedding inference works" || echo "  ❌ Failed"
echo ""

# Test 4: Drift endpoint
echo "✓ Test 4: Drift computation"
response=$(curl -s "$API_URL/drift/latest")
if echo "$response" | grep -q "kl_divergence\|no_data"; then
  echo "  ✅ Drift endpoint responding"
  if echo "$response" | grep -q "embedding_drift"; then
    echo "  ✅ Embedding drift field present"
  fi
else
  echo "  ❌ Drift endpoint failed"
fi
echo ""

# Test 5: Check stats
echo "✓ Test 5: System stats"
stats=$(curl -s "$API_URL/stats")
echo "$stats" | grep -q "total_inferences" && echo "  ✅ Stats endpoint works" || echo "  ❌ Failed"
echo ""

echo "================================================================="
echo "Testing complete! Check output above for any ❌ marks."
echo ""
echo "Next steps:"
echo "  1. Run: docker-compose up --build"
echo "  2. Wait 30 seconds for services to start"
echo "  3. Run: ./scripts/generate-data-with-embeddings.sh"
echo "  4. Wait 5-10 minutes for drift runs"
echo "  5. Check: curl http://localhost:3001/drift/latest"
