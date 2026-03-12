const pool = require('./src/config/db');
require('dotenv').config();

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'historial_revisiones_excel'
    `);
    console.log('Columns in historial_revisiones_excel:');
    res.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error checking schema:', err);
    process.exit(1);
  }
}

checkSchema();
