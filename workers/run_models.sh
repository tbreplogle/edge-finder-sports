
#!/usr/bin/env bash
set -e
declare -a sports=(nfl ncaaf ncaab mlb)

echo "Starting prediction models at $(date)"

for s in "${sports[@]}"; do
  echo "→ Running $s model"
  Rscript "models/$s/predict.R" > "/tmp/${s}.csv"
  echo "→ Importing $s predictions"
  node -e "require('./workers/importCsv.js')('/tmp/${s}.csv', '$s')"
done

echo "All models completed successfully at $(date)"
