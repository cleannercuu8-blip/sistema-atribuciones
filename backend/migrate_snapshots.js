const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://atribuciones_db_user:XpI6B410jMv7D8CndD7R9CpsG64f5u30@dpg-cv0pqu0gph6c738eunr0-a.oregon-postgres.render.com/atribuciones_db",
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('🚀 Iniciando migración de snapshots...');
        await pool.query(`
            ALTER TABLE observaciones 
            ADD COLUMN IF NOT EXISTS valor_original TEXT,
            ADD COLUMN IF NOT EXISTS valor_subsanado TEXT;
        `);
        console.log('✅ Columnas valor_original y valor_subsanado agregadas correctamente.');
    } catch (err) {
        console.error('❌ Error en migración:', err.message);
    } finally {
        await pool.end();
        process.exit();
    }
}

run();
