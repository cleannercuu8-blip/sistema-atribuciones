const pool = require('../config/db');

// GET /api/dashboard/stats-innovadoras
const getStatsInnovadoras = async (req, res) => {
    try {
        // 1. Balance de Responsabilidades (Consolidado de proyectos y atribuciones)
        const workloadResult = await pool.query(`
            SELECT 
                u.nombre as responsable, 
                (COALESCE(p_count.total, 0) + COALESCE(ae_count.total, 0))::int as total
            FROM usuarios u
            LEFT JOIN (
                SELECT created_by, COUNT(*) as total FROM proyectos GROUP BY created_by
            ) p_count ON u.id = p_count.created_by
            LEFT JOIN (
                SELECT responsable_id, COUNT(*) as total FROM atribuciones_especificas WHERE activo = true GROUP BY responsable_id
            ) ae_count ON u.id = ae_count.responsable_id
            WHERE (COALESCE(p_count.total, 0) + COALESCE(ae_count.total, 0)) > 0
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
