
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { Pool } = require('pg');

// Connect to PostgreSQL using the DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Import a CSV file into the database
async function importCsv(filePath, sport) {
  try {
    console.log(`Reading ${sport} predictions from ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true
    });

    for (const record of records) {
      await importCsvRow(record);
    }

    console.log(`Successfully imported ${records.length} ${sport} predictions`);
  } catch (error) {
    console.error(`Error importing ${sport} predictions:`, error);
    throw error;
  }
}

// Import a single row into the database
async function importCsvRow(record) {
  try {
    // Normalize the sport to uppercase
    const sport = record.sport ? record.sport.toUpperCase() : 'UNKNOWN';
    
    // Extract values from the record (or use defaults)
    const {
      game_id,
      home_team,
      away_team,
      predicted_margin,
      predicted_total,
      confidence_pct,
      home_ml,
      away_ml,
      market_home_ml,
      market_away_ml,
      edge,
      date = new Date().toISOString().split('T')[0] // Today's date by default
    } = record;
    
    console.log(`Importing prediction for ${sport}: ${away_team} @ ${home_team}`);

    // Use UPSERT to avoid duplicates
    const query = `
      INSERT INTO predictions (
        sport, 
        game_id, 
        home_team, 
        away_team, 
        predicted_margin, 
        predicted_total,
        confidence_pct,
        home_ml,
        away_ml,
        market_home_ml,
        market_away_ml,
        edge,
        game_date,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
      )
      ON CONFLICT (sport, game_id) 
      DO UPDATE SET 
        home_team = $3,
        away_team = $4,
        predicted_margin = $5,
        predicted_total = $6,
        confidence_pct = $7,
        home_ml = $8,
        away_ml = $9,
        market_home_ml = $10,
        market_away_ml = $11,
        edge = $12,
        game_date = $13,
        updated_at = NOW()
    `;
    
    await pool.query(query, [
      sport,
      game_id,
      home_team,
      away_team,
      predicted_margin,
      predicted_total,
      confidence_pct,
      home_ml,
      away_ml,
      market_home_ml,
      market_away_ml,
      edge,
      date
    ]);
    
    console.log(`Successfully imported ${sport} prediction for ${game_id}`);
  } catch (error) {
    console.error('Error importing prediction row:', error);
    throw error;
  }
}

module.exports = { importCsv, importCsvRow };
