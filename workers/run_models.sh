
#!/usr/bin/env bash
set -e
declare -a sports=(nfl ncaaf ncaab)

echo "Starting prediction models at $(date)"

# Run direct node.js MLB predictions first
echo "→ Running MLB direct predictions"
node workers/updatePredictions.js

# Then run other models using R
for s in "${sports[@]}"; do
  echo "→ Running $s model"
  Rscript "models/$s/predict.R" > "/tmp/${s}.csv"
  echo "→ Importing $s predictions"
  node -e "require('./workers/importCsv').importCsv('/tmp/${s}.csv', '$s')"
done

echo "All models completed successfully at $(date)"
