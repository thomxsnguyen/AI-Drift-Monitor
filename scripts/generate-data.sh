#!/bin/bash
set -e

API_URL="${1:-http://localhost:3001}"
MODEL_ID=1

send_inference() {
    local confidence=$1
    local class=$2
    
    curl -s -X POST "$API_URL/inference" \
        -H "Content-Type: application/json" \
        -d "{
            \"model_id\": $MODEL_ID,
            \"input_data\": {\"f1\": $RANDOM, \"f2\": $RANDOM},
            \"prediction\": {\"class\": \"$class\"},
            \"confidence\": $confidence
        }" > /dev/null
}

random_float() {
    local min=$1
    local range=$2
    echo "scale=4; $min + ($RANDOM % $range) / 1000" | bc
}

echo "Sending baseline data (n=50, confidence ~0.85)..."
for i in $(seq 1 50); do
    conf=$(random_float 0.8 150)
    send_inference "$conf" "positive"
    printf "\r  Progress: %d/50" "$i"
done
echo ""

echo "Sending drift data (n=20, confidence ~0.5)..."
for i in $(seq 1 20); do
    conf=$(random_float 0.4 200)
    send_inference "$conf" "uncertain"
    printf "\r  Progress: %d/20" "$i"
done
echo ""

echo "Done. Dashboard: http://localhost:3000"
