const pool = require('../config/db');
const path = require('path');

// GET /api/proyectos
const listar = async (req, res) => {
    try {
        let query;
        let params = [];

        if (req.user.rol === 'admin' || req.user.rol === 'revisor') {
            query = `
        SELECT p.*, d.nombre as dependencia_nombre, d.tipo as dependencia_tipo,
               ep.nombre as estado_nombre, ep.color as estado_color,
               av.nombre as avance_nombre,
               u.nombre as creado_por
        FROM proyectos p
        JOIN dependencias d ON p.dependencia_id = d.id
        LEFT JOIN cat_estados_proyecto ep ON p.estado_id = ep.id
        LEFT JOIN cat_avances av ON p.avance_id = av.id
        LEFT JOIN usuarios u ON p.created_by = u.id
        ORDER BY p.created_at DESC`;
        } else {
            query = `
        SELECT p.*, d.nombre as dependencia_nombre, d.tipo as dependencia_tipo,
               ep.nombre as estado_nombre, ep.color as estado_color,
               av.nombre as avance_nombre,
               u.nombre as creado_por, pu.rol_en_proyecto
        FROM proyectos p
        JOIN dependencias d ON p.dependencia_id = d.id
        LEFT JOIN cat_estados_proyecto ep ON p.estado_id = ep.id
        LEFT JOIN cat_avances av ON p.avance_id = av.id
        LEFT JOIN usuarios u ON p.created_by = u.id
        JOIN proyecto_usuarios pu ON pu.proyecto_id = p.id AND pu.usuario_id = $1
        ORDER BY p.created_at DESC`;
            params = [req.user.id];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// GET /api/proyectos/:id
const obtener = async (req, res) => {
    const { id } = req.params;
    try {
        const proyResult = await pool.query(
            `SELECT p.*, d.nombre as dependencia_nombre, d.tipo as dependencia_tipo,
                    ep.nombre as estado_nombre, ep.color as estado_color
       FROM proyectos p 
       JOIN dependencias d ON p.dependencia_id = d.id
       LEFT JOIN cat_estados_proyecto ep ON p.estado_id = ep.id
       WHERE p.id = $1`,
            [id]
        );
        if (proyResult.rows.length === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });

        const proyecto = proyResult.rows[0];

        // Usuarios asignados
        const usuariosResult = await pool.query(
            `SELECT u.id, u.nombre, u.email, u.rol, pu.rol_en_proyecto
       FROM proyecto_usuarios pu JOIN usuarios u ON pu.usuario_id = u.id
       WHERE pu.proyecto_id = $1`,
            [id]
        );
        proyecto.usuarios = usuariosResult.rows;

        // Revisores asignados
        const revisoresResult = await pool.query(
            `SELECT u.id, u.nombre, u.email, pr.es_lider
       FROM proyecto_revisores pr JOIN usuarios u ON pr.usuario_id = u.id
       WHERE pr.proyecto_id = $1`,
            [id]
        );
        proyecto.revisores = revisoresResult.rows;

        res.json(proyecto);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// POST /api/proyectos
const crear = async (req, res) => {
    if (req.user.rol === 'visualizador' || req.user.rol === 'enlace') {
        return res.status(403).json({ error: 'Tu rol no permite crear proyectos' });
    }
    const { nombre, dependencia_id, responsable, responsable_apoyo, enlaces, fecha_expediente, usuarios_ids, revisores_ids, estado_id, avance_id } = req.body;
    if (!nombre || !dependencia_id)
        return res.status(400).json({ error: 'Nombre y dependencia son requeridos' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Resolver estado_id: del formulario o por defecto 'Borrador'
        let resolvedEstadoId = estado_id || null;
        if (!resolvedEstadoId) {
            const defRes = await client.query(`SELECT id FROM cat_estados_proyecto WHERE nombre = 'Borrador' LIMIT 1`);
            if (defRes.rows.length > 0) resolvedEstadoId = defRes.rows[0].id;
        }

        const proyResult = await client.query(
            `INSERT INTO proyectos (nombre, dependencia_id, responsable, responsable_apoyo, enlaces, fecha_expediente, created_by, estado_id, avance_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [nombre, dependencia_id, responsable, responsable_apoyo || null, enlaces, fecha_expediente, req.user.id, resolvedEstadoId, avance_id || null]
        );
        const proyecto = proyResult.rows[0];

        // LOG ACTIVIDAD: Creación
        await client.query(
            `INSERT INTO actividades (tipo, entidad, entidad_id, proyecto_id, mensaje, autor)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            ['creacion', 'proyecto', proyecto.id, proyecto.id, `Proyecto "${nombre}" creado`, req.user.nombre]
        );

        if (usuarios_ids && usuarios_ids.length > 0) {
            for (const uid of usuarios_ids) {
                await client.query(
                    `INSERT INTO proyecto_usuarios (proyecto_id, usuario_id, rol_en_proyecto)
           VALUES ($1, $2, 'ayudante') ON CONFLICT DO NOTHING`,
                    [proyecto.id, uid]
                );
            }
        }

        if (revisores_ids && revisores_ids.length > 0) {
            for (let i = 0; i < revisores_ids.length; i++) {
                await client.query(
                    `INSERT INTO proyecto_revisores (proyecto_id, usuario_id, es_lider)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                    [proyecto.id, revisores_ids[i], i === 0]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json(proyecto);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Error del servidor' });
    } finally {
        client.release();
    }
};

// PUT /api/proyectos/:id
const actualizar = async (req, res) => {
    if (req.user.rol === 'visualizador') {
        return res.status(403).json({ error: 'No tienes permiso para editar' });
    }
    const { id } = req.params;
    const { nombre, dependencia_id, responsable, responsable_apoyo, enlaces, fecha_expediente, estado_id, avance_id, usuarios_ids, revisores_ids } = req.body;

    const proyCheck = await pool.query('SELECT created_by, responsable, responsable_apoyo FROM proyectos WHERE id = $1', [id]);
    if (proyCheck.rows.length === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });

    // Solo admin o el responsable asignado pueden editar
    if (req.user.rol !== 'admin') {
        const p = proyCheck.rows[0];
        const isLead = p.responsable === req.user.nombre;
        const isSupport = p.responsable_apoyo && p.responsable_apoyo.includes(req.user.nombre);
        const isCreator = p.created_by === req.user.id;

        if (req.user.rol === 'enlace') {
            if (!isLead && !isSupport) {
                return res.status(403).json({ error: 'Solo puedes editar tus proyectos asignados' });
            }
        } else if (!isCreator && !isLead) { // For other roles that might have edit permissions (e.g., 'revisor' if allowed, or creator)
            return res.status(403).json({ error: 'No tienes permiso para editar este proyecto' });
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            `UPDATE proyectos 
             SET nombre=$1, dependencia_id=$2, responsable=$3, responsable_apoyo=$4, enlaces=$5, fecha_expediente=$6, estado_id=$7, avance_id=$8, updated_at=NOW() 
             WHERE id=$9`,
            [nombre, dependencia_id, responsable, responsable_apoyo || null, enlaces, fecha_expediente, estado_id || null, avance_id || null, id]
        );

        // LOG ACTIVIDAD: Actualización
        await client.query(
            `INSERT INTO actividades (tipo, entidad, entidad_id, proyecto_id, mensaje, autor)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            ['actualizacion', 'proyecto', id, id, `Proyecto "${nombre}" actualizado`, req.user.nombre]
        );

        if (usuarios_ids !== undefined) {
            await client.query('DELETE FROM proyecto_usuarios WHERE proyecto_id = $1', [id]);
            for (const uid of usuarios_ids) {
                await client.query(
                    `INSERT INTO proyecto_usuarios (proyecto_id, usuario_id, rol_en_proyecto) VALUES ($1, $2, 'ayudante') ON CONFLICT DO NOTHING`,
                    [id, uid]
                );
            }
        }

        if (revisores_ids !== undefined) {
            await client.query('DELETE FROM proyecto_revisores WHERE proyecto_id = $1', [id]);
            for (let i = 0; i < revisores_ids.length; i++) {
                await client.query(
                    `INSERT INTO proyecto_revisores (proyecto_id, usuario_id, es_lider) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                    [id, revisores_ids[i], i === 0]
                );
            }
        }

        await client.query('COMMIT');
        const result = await pool.query('SELECT * FROM proyectos WHERE id = $1', [id]);
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Error del servidor' });
    } finally {
        client.release();
    }
};

const eliminar = async (req, res) => {
    if (req.user.rol === 'visualizador') {
        return res.status(403).json({ error: 'No tienes permiso para eliminar' });
    }
    const { id } = req.params;
    try {
        const proyCheck = await pool.query('SELECT created_by, responsable, responsable_apoyo, nombre FROM proyectos WHERE id = $1', [id]);
        if (proyCheck.rows.length === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });

        // Para enlace, verificar si es su proyecto
        if (req.user.rol !== 'admin') {
            const p = proyCheck.rows[0];
            const isLead = p.responsable === req.user.nombre;
            const isSupport = p.responsable_apoyo && p.responsable_apoyo.includes(req.user.nombre);
            const isCreator = p.created_by === req.user.id;

            if (req.user.rol === 'enlace') {
                if (!isLead && !isSupport) {
                    return res.status(403).json({ error: 'Solo puedes eliminar tus proyectos asignados' });
                }
            } else if (!isCreator && !isLead) { // For other roles that might have delete permissions (e.g., creator)
                return res.status(403).json({ error: 'No tienes permiso para eliminar este proyecto' });
            }
        }

        // LOG ACTIVIDAD: Eliminación (Mensaje antes de borrar)
        await pool.query(
            `INSERT INTO actividades (tipo, entidad, entidad_id, proyecto_id, mensaje, autor)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            ['eliminacion', 'proyecto', id, null, `Proyecto "${proyCheck.rows[0].nombre}" eliminado`, req.user.nombre]
        );

        await pool.query('DELETE FROM proyectos WHERE id = $1', [id]);
        res.json({ mensaje: 'Proyecto eliminado correctamente' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error del servidor al eliminar proyecto' });
    }
};

// POST /api/proyectos/:id/organigrama  (subir PDF)
const subirOrganigrama = async (req, res) => {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

    try {
        const url = `/uploads/organigramas/${req.file.filename}`;
        await pool.query('UPDATE proyectos SET organigrama_url = $1 WHERE id = $2', [url, id]);
        res.json({ url, mensaje: 'Organigrama subido correctamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar el organigrama' });
    }
};

module.exports = { listar, obtener, crear, actualizar, eliminar, subirOrganigrama };
