const pool = require('./src/config/db');

async function checkDB() {
    try {
        const tables = [
            'dependencias',
            'cat_responsables',
            'cat_enlaces',
            'cat_avances',
            'cat_estados_proyecto'
        ];

        for (const table of tables) {
            const res = await pool.query(`SELECT count(*) FROM ${table}`);
            console.log(`Table ${table}: ${res.rows[0].count} rows`);
            if (res.rows[0].count > 0) {
                const data = await pool.query(`SELECT * FROM ${table} LIMIT 5`);
                console.log(`Sample data from ${table}:`, data.rows);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error('Error checking DB:', err);
        process.exit(1);
    }
}

checkDB();
