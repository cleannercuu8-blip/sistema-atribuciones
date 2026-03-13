const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_HgOvRf8y5trJ@ep-green-moon-a412r1aj.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function check() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables:', res.rows.map(r => r.table_name));
        
        const users = await pool.query("SELECT count(*) FROM usuarios");
        console.log('Total users:', users.rows[0].count);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

check();
