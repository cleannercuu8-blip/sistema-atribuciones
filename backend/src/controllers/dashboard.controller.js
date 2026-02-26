const pool = require('../config/db');

// GET /api/dashboard/stats-innovadoras
const getStatsInnovadoras = async (req, res) => {
    try {
        // 1. Balance de Responsabilidades (Conteo de Roles de Liderazgo y Apoyo múltiple)
        const workloadResult = await pool.query(`
            WITH combined_responsables AS (
                -- Responsable principal
                SELECT responsable as nombre, id as proyecto_id FROM proyectos WHERE responsable IS NOT NULL AND responsable != ''
                UNION ALL
                -- Responsables de apoyo (separamos por coma)
                SELECT regexp_split_to_table(responsable_apoyo, ',\\s*') as nombre, id as proyecto_id FROM proyectos WHERE responsable_apoyo IS NOT NULL AND responsable_apoyo != ''
            )
            SELECT nombre as responsable, COUNT(*)::int as total
            FROM combined_responsables
            GROUP BY nombre
            ORDER BY total DESC
        `);

        // 2. Feed de Validaciones y Actividades (Todo lo registrado en la tabla actividades)
        const activityResult = await pool.query(`
            SELECT 
                tipo, 
                mensaje, 
                created_at, 
                autor,
                (SELECT nombre FROM proyectos WHERE id = proyecto_id) as proyecto_nombre
            FROM actividades
            ORDER BY created_at DESC
            LIMIT 15
        `);

        res.json({
            workload: workloadResult.rows,
            activity: activityResult.rows
        });
    } catch (err) {
        console.error('Error en stats innovadoras:', err);
        res.status(500).json({ error: 'Error al obtener estadísticas innovadoras' });
    }
};

module.exports = { getStatsInnovadoras };
