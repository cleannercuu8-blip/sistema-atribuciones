const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// pool.on('connect', () => {
//   console.log('✅ Conectado a PostgreSQL');
// });

pool.on('error', (err) => {
  console.error('❌ Error en la conexión a PostgreSQL:', err);
});

module.exports = pool;
