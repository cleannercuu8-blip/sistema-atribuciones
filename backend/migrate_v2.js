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

        // 1. Convert responsable_apoyo to TEXT[] or handle multiple values
        // To be safe and simple with the current VARCHAR(200) column, 
        // we'll change it to TEXT so it can hold comma-separated names or JSON.
        // However, Postgres ARRAY is cleaner.
        await client.query(`
        ALTER TABLE proyectos 
        ALTER COLUMN responsable_apoyo TYPE TEXT;
    `);

        // 2. Create an actual activities table for "everything that is done"
        await client.query(`
        CREATE TABLE IF NOT EXISTS actividades (
            id SERIAL PRIMARY KEY,
            tipo VARCHAR(50) NOT NULL, -- 'creacion', 'actualizacion', 'eliminacion', 'observacion', etc.
            entidad VARCHAR(50),       -- 'proyecto', 'atribucion', 'unidad', etc.
            entidad_id INTEGER,
            proyecto_id INTEGER REFERENCES proyectos(id) ON DELETE CASCADE,
            mensaje TEXT NOT NULL,
            autor VARCHAR(200),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

        // 3. (Optional) Seed some activities from existing observations if empty
        const count = await client.query('SELECT count(*) FROM actividades');
        if (parseInt(count.rows[0].count) === 0) {
            await client.query(`
            INSERT INTO actividades (tipo, entidad, entidad_id, proyecto_id, mensaje, autor, created_at)
            SELECT 'observacion', 'observacion', o.id, r.proyecto_id, o.texto_observacion, u.nombre, o.created_at
            FROM observaciones o
            JOIN revisiones r ON o.revision_id = r.id
            JOIN usuarios u ON r.revisor_id = u.id;
        `);
        }

        await client.query('COMMIT');
        console.log('Migration completed: multiple support support and activities table ready');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error migrating:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
