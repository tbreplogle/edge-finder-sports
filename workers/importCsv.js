
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { Pool } = require('pg');

// Function to import a single prediction row
async function importCsvRow(row) {
  const pg = new Pool({ connectionString: process.env.DATABASE_URL });

  const sql = `INSERT INTO predictions
      (sport, game_id, home_team, away_team,
       predicted_margin, predicted_total, confidence_pct, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,now())
    ON CONFLICT (sport, game_id)
    DO UPDATE SET predicted_margin = EXCLUDED.predicted_margin,
                  predicted_total  = EXCLUDED.predicted_total,
                  confidence_pct   = EXCLUDED.confidence_pct,
                  updated_at       = now()`;

  try {
    await pg.query(sql, [
      row.sport.toUpperCase(),
      row.game_id,
      row.home_team,
      row.away_team,
      Number(row.predicted_margin),
      row.predicted_total !== null ? Number(row.predicted_total) : null,
      Number(row.confidence_pct)
    ]);
    
    console.log(`Successfully imported prediction for game ${row.game_id} (${row.sport})`);
    return true;
  } catch (error) {
    console.error(`Error importing prediction for game ${row.game_id}:`, error);
    throw error;
  } finally {
    await pg.end();
  }
}

// Original function to import from CSV file
async function importCsv(path, sport) {
  const rows = parse(fs.readFileSync(path, 'utf8'), { columns: true });
  const pg = new Pool({ connectionString: process.env.DATABASE_URL });

  const sql = `INSERT INTO predictions
      (sport, game_id, home_team, away_team,
       predicted_margin, predicted_total, confidence_pct, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,now())
    ON CONFLICT (sport, game_id)
    DO UPDATE SET predicted_margin = EXCLUDED.predicted_margin,
                  predicted_total  = EXCLUDED.predicted_total,
                  confidence_pct   = EXCLUDED.confidence_pct,
                  updated_at       = now()`;

  try {
    console.log(`Importing ${rows.length} predictions for ${sport}...`);
    
    for (const r of rows) {
      await pg.query(sql, [
        sport.toUpperCase(),
        r.game_id,
        r.home_team,
        r.away_team,
        Number(r.predicted_margin),
        Number(r.predicted_total),
        Number(r.confidence_pct)
      ]);
    }
    
    console.log(`Successfully imported ${rows.length} predictions for ${sport}`);
  } catch (error) {
    console.error(`Error importing ${sport} predictions:`, error);
    throw error;
  } finally {
    await pg.end();
  }
}

module.exports = {
  importCsv,
  importCsvRow
};
