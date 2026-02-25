const pool = require('../config/db');
const emailService = require('../services/email.service');

// Función auxiliar: calcular fecha límite en días hábiles
const agregarDiasHabiles = (fecha, dias) => {
    let d = new Date(fecha);
    let agregados = 0;
    while (agregados < dias) {
        d.setDate(d.getDate() + 1);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) agregados++; // excluir sábado y domingo
    }
    return d;
};

// GET /api/proyectos/:proyectoId/revisiones
const listar = async (req, res) => {
    const { proyectoId } = req.params;
    try {
        const result = await pool.query(
            `SELECT r.*, u.nombre as revisor_nombre,
              COUNT(o.id) FILTER (WHERE o.estado = 'pendiente') as obs_pendientes,
              COUNT(o.id) as obs_total
       FROM revisiones r
       JOIN usuarios u ON r.revisor_id = u.id
       LEFT JOIN observaciones o ON o.revision_id = r.id
       WHERE r.proyecto_id = $1
       GROUP BY r.id, u.nombre
       ORDER BY r.numero_revision DESC`,
            [proyectoId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// POST /api/proyectos/:proyectoId/revisiones
const crear = async (req, res) => {
    const { proyectoId } = req.params;
    const { dias_habiles_plazo, notas } = req.body;
    const diasPlazo = dias_habiles_plazo || 10;

    try {
        // Número de revisión correlativo
        const numResult = await pool.query(
            'SELECT COALESCE(MAX(numero_revision), 0) + 1 as siguiente FROM revisiones WHERE proyecto_id = $1',
            [proyectoId]
        );
        const numeroRevision = numResult.rows[0].siguiente;
        const fechaInicio = new Date();
        const fechaLimite = agregarDiasHabiles(fechaInicio, diasPlazo);

        const result = await pool.query(
            `INSERT INTO revisiones (proyecto_id, numero_revision, revisor_id, dias_habiles_plazo, fecha_inicio, fecha_limite, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [proyectoId, numeroRevision, req.user.id, diasPlazo, fechaInicio, fechaLimite, notas]
        );

        // Actualizar estado del proyecto a 'en_revision'
        await pool.query(`UPDATE proyectos SET estado='en_revision', updated_at=NOW() WHERE id=$1`, [proyectoId]);

        // Enviar emails a usuarios del proyecto
        const usuariosResult = await pool.query(
            `SELECT u.email, u.nombre FROM proyecto_usuarios pu JOIN usuarios u ON pu.usuario_id = u.id WHERE pu.proyecto_id = $1`,
            [proyectoId]
        );
        const destinatarios = usuariosResult.rows;
        for (const dest of destinatarios) {
            await emailService.enviarNotificacion(
                dest.email,
                `Revisión ${numeroRevision} abierta - Sistema de Atribuciones`,
                `Estimado/a ${dest.nombre},\n\nSe ha abierto la revisión #${numeroRevision} para su proyecto.\nPlazo para subsanación: ${diasPlazo} días hábiles.\nFecha límite: ${fechaLimite.toLocaleDateString('es-MX')}.\n\nPor favor ingrese al sistema para revisar las observaciones.\n\nSistema de Atribuciones`
            );
        }

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// GET /api/revisiones/:id/observaciones
const listarObservaciones = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT o.*, ae.clave as atribucion_clave, ae.texto as atribucion_texto,
              ua.nombre as unidad_nombre, ua.siglas as unidad_siglas
       FROM observaciones o
       LEFT JOIN atribuciones_especificas ae ON o.atribucion_especifica_id = ae.id
       LEFT JOIN unidades_administrativas ua ON o.unidad_id = ua.id
       WHERE o.revision_id = $1
       ORDER BY o.created_at ASC`,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// POST /api/revisiones/:id/observaciones
const crearObservacion = async (req, res) => {
    const { id } = req.params;
    const { atribucion_especifica_id, unidad_id, texto_observacion } = req.body;
    if (!texto_observacion) return res.status(400).json({ error: 'El texto de la observación es requerido' });
    try {
        const result = await pool.query(
            `INSERT INTO observaciones (revision_id, atribucion_especifica_id, unidad_id, texto_observacion)
       VALUES ($1,$2,$3,$4) RETURNING *`,
            [id, atribucion_especifica_id || null, unidad_id || null, texto_observacion]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// PUT /api/observaciones/:id/subsanar
const subsanarObservacion = async (req, res) => {
    const { id } = req.params;
    const { respuesta } = req.body;
    try {
        const result = await pool.query(
            `UPDATE observaciones SET estado='subsanada', respuesta=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
            [respuesta, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Observación no encontrada' });

        // Verificar si todas las observaciones de la revisión están subsanadas
        const obs = result.rows[0];
        const pendientes = await pool.query(
            `SELECT COUNT(*) as total FROM observaciones WHERE revision_id = $1 AND estado = 'pendiente'`,
            [obs.revision_id]
        );
        if (parseInt(pendientes.rows[0].total) === 0) {
            // Cerrar revisión automáticamente
            await pool.query(
                `UPDATE revisiones SET estado='cerrada', fecha_cierre=NOW() WHERE id=$1`,
                [obs.revision_id]
            );
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// PUT /api/revisiones/:id/cerrar  (cierre manual por revisor)
const cerrarRevision = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(
            `UPDATE revisiones SET estado='cerrada', fecha_cierre=NOW() WHERE id=$1`,
            [id]
        );
        // Si no hay más revisiones abiertas el proyecto vuelve a borrador
        const abiertas = await pool.query(
            `SELECT r.proyecto_id FROM revisiones r WHERE r.id=$1`, [id]
        );
        const proyId = abiertas.rows[0]?.proyecto_id;
        if (proyId) {
            const otrasAbiertas = await pool.query(
                `SELECT COUNT(*) as total FROM revisiones WHERE proyecto_id=$1 AND estado='abierta'`, [proyId]
            );
            if (parseInt(otrasAbiertas.rows[0].total) === 0) {
                await pool.query(`UPDATE proyectos SET estado='borrador' WHERE id=$1`, [proyId]);
            }
        }
        res.json({ mensaje: 'Revisión cerrada' });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// PUT /api/proyectos/:proyectoId/aprobar
const aprobarProyecto = async (req, res) => {
    const { proyectoId } = req.params;
    try {
        // Verificar que no haya revisiones abiertas
        const abiertas = await pool.query(
            `SELECT COUNT(*) as total FROM revisiones WHERE proyecto_id=$1 AND estado='abierta'`, [proyectoId]
        );
        if (parseInt(abiertas.rows[0].total) > 0)
            return res.status(400).json({ error: 'Hay revisiones abiertas pendientes de cierre' });

        await pool.query(`UPDATE proyectos SET estado='aprobado', updated_at=NOW() WHERE id=$1`, [proyectoId]);
        res.json({ mensaje: 'Proyecto aprobado' });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

module.exports = { listar, crear, listarObservaciones, crearObservacion, subsanarObservacion, cerrarRevision, aprobarProyecto };
