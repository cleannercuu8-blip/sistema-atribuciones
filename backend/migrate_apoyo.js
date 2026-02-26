require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
    try {
        await pool.query('ALTER TABLE proyectos ADD COLUMN responsable_apoyo VARCHAR(200);');
        console.log('Column responsable_apoyo added successfully');
    } catch (err) {
        if (err.code === '42701') {
            console.log('Column already exists');
        } else {
            console.error('Error migrating:', err);
        }
    } finally {
        await pool.end();
    }
}

migrate();
