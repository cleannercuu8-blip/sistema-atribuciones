require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Crear tabla de historial de Excel de revisión
        await client.query(`
            CREATE TABLE IF NOT EXISTS historial_revisiones_excel (
                id SERIAL PRIMARY KEY,
                proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
                nombre_archivo VARCHAR(255),
                total_cambios INTEGER DEFAULT 0,
                cambios_aplicados INTEGER DEFAULT 0,
                usuario_id INTEGER,
                usuario_nombre VARCHAR(200),
                resumen_cambios JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_historial_rev_excel_proyecto
            ON historial_revisiones_excel(proyecto_id);
        `);

        await client.query('COMMIT');
        console.log('✅ Migración v3 completada: tabla historial_revisiones_excel creada.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error en migración v3:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
