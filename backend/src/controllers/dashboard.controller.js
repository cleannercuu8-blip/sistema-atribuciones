const pool = require('../config/db');

// GET /api/dashboard/stats-innovadoras
const getStatsInnovadoras = async (req, res) => {
    try {
        // 1. Balance de Responsabilidades (Consolidado de proyectos por usuario)
        const workloadResult = await pool.query(`
            WITH user_projects AS (
                -- Proyectos creados por el usuario
                SELECT created_by as usuario_id, id as proyecto_id FROM proyectos
                UNION
                -- Proyectos asignados para revisión
                SELECT usuario_id, proyecto_id FROM proyecto_revisores
            )
            SELECT 
                u.nombre as responsable, 
                COUNT(up.proyecto_id)::int as total
            FROM usuarios u
            JOIN user_projects up ON u.id = up.usuario_id
            WHERE u.activo = true
            GROUP BY u.nombre
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
