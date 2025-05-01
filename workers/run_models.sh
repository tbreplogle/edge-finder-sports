
#!/usr/bin/env bash
set -e
declare -a sports=(nfl ncaaf ncaab mlb)

echo "Starting prediction models at $(date)"

# Run direct node.js MLB predictions first
echo "→ Running MLB direct predictions"
node workers/updatePredictions.js

# Then run other models using R
for s in "${sports[@]}"; do
  # Skip MLB since we already ran it directly
  if [ "$s" != "mlb" ]; then
    echo "→ Running $s model"
    Rscript "models/$s/predict.R" > "/tmp/${s}.csv"
    echo "→ Importing $s predictions"
    node -e "require('./workers/importCsv').importCsv('/tmp/${s}.csv', '$s')"
  fi
done

echo "All models completed successfully at $(date)"
