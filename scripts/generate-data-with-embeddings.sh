#!/bin/bash
set -e

API_URL="${1:-http://localhost:3001}"
MODEL_ID=1

send_inference() {
    local confidence=$1
    local class=$2
    local emb1=$3
    local emb2=$4
    local emb3=$5
    local emb4=$6
    
    curl -s -X POST "$API_URL/inference" \
        -H "Content-Type: application/json" \
        -d "{
            \"model_id\": $MODEL_ID,
            \"input_data\": {\"f1\": $RANDOM, \"f2\": $RANDOM},
            \"prediction\": {\"class\": \"$class\"},
            \"confidence\": $confidence,
            \"embedding\": [$emb1, $emb2, $emb3, $emb4]
        }" > /dev/null
}

random_float() {
    local min=$1
    local range=$2
    echo "scale=4; $min + ($RANDOM % $range) / 1000" | bc
}

random_embedding() {
    local base=$1
    local noise=$2
    echo "scale=4; $base + (($RANDOM % $noise) - $noise / 2) / 1000" | bc
}

echo "Sending baseline data (n=50, confidence ~0.85, embeddings around [0.8, 0.2, 0.3, 0.9])..."
for i in $(seq 1 50); do
    conf=$(random_float 0.8 150)
    e1=$(random_embedding 0.8 100)
    e2=$(random_embedding 0.2 100)
    e3=$(random_embedding 0.3 100)
    e4=$(random_embedding 0.9 100)
    send_inference "$conf" "positive" "$e1" "$e2" "$e3" "$e4"
    printf "\r  Progress: %d/50" "$i"
done
echo ""

echo "Sending drift data (n=30, confidence ~0.5, embeddings around [0.4, 0.6, 0.7, 0.3])..."
for i in $(seq 1 30); do
    conf=$(random_float 0.4 200)
    e1=$(random_embedding 0.4 150)
    e2=$(random_embedding 0.6 150)
    e3=$(random_embedding 0.7 150)
    e4=$(random_embedding 0.3 150)
    send_inference "$conf" "uncertain" "$e1" "$e2" "$e3" "$e4"
    printf "\r  Progress: %d/30" "$i"
done
echo ""

echo "Done. Dashboard: http://localhost:3000"
echo "Note: Adaptive thresholds will improve after 10+ drift runs"
