const pool = require('../config/db');

// GET /api/dashboard/stats-innovadoras
const getStatsInnovadoras = async (req, res) => {
    try {
        // 1. Balance de Responsabilidades (Conteo de Roles de Liderazgo y Apoyo del catálogo)
        const workloadResult = await pool.query(`
            WITH combined_responsables AS (
                SELECT responsable as nombre, id as proyecto_id FROM proyectos WHERE responsable IS NOT NULL AND responsable != ''
                UNION ALL
                SELECT responsable_apoyo as nombre, id as proyecto_id FROM proyectos WHERE responsable_apoyo IS NOT NULL AND responsable_apoyo != ''
            )
            SELECT nombre as responsable, COUNT(*)::int as total
            FROM combined_responsables
            GROUP BY nombre
            ORDER BY total DESC
        `);

        // 2. Feed de Validaciones Recientes (Observaciones y cambios de estado)
        // Combinamos las últimas observaciones
        const activityResult = await pool.query(`
            (
                SELECT 
                    'observacion' as tipo, 
                    o.id as item_id, 
                    o.texto_observacion as mensaje, 
                    o.created_at, 
                    p.nombre as proyecto_nombre, 
                    u.nombre as autor
                FROM observaciones o
                JOIN revisiones r ON o.revision_id = r.id
                JOIN proyectos p ON r.proyecto_id = p.id
                JOIN usuarios u ON r.revisor_id = u.id
            )
            UNION ALL
            (
                SELECT 
                    'estado' as tipo, 
                    p.id as item_id, 
                    'Proyecto pasó a estado ' || p.estado as mensaje, 
                    p.updated_at as created_at, 
                    p.nombre as proyecto_nombre, 
                    'Sistema' as autor
                FROM proyectos p
                WHERE p.updated_at > p.created_at
            )
            ORDER BY created_at DESC
            LIMIT 10
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
