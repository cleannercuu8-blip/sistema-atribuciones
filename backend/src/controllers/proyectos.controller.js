const pool = require('../config/db');
const path = require('path');

// GET /api/proyectos
const listar = async (req, res) => {
    try {
        let query;
        let params = [];

        if (req.user.rol === 'admin') {
            query = `
        SELECT p.*, d.nombre as dependencia_nombre, d.tipo as dependencia_tipo,
               u.nombre as creado_por
        FROM proyectos p
        JOIN dependencias d ON p.dependencia_id = d.id
        LEFT JOIN usuarios u ON p.created_by = u.id
        ORDER BY p.created_at DESC`;
        } else if (req.user.rol === 'revisor') {
            query = `
        SELECT p.*, d.nombre as dependencia_nombre, d.tipo as dependencia_tipo,
               u.nombre as creado_por
        FROM proyectos p
        JOIN dependencias d ON p.dependencia_id = d.id
        LEFT JOIN usuarios u ON p.created_by = u.id
        ORDER BY p.created_at DESC`;
        } else {
            // dependencia: solo sus proyectos asignados
            query = `
        SELECT p.*, d.nombre as dependencia_nombre, d.tipo as dependencia_tipo,
               u.nombre as creado_por, pu.rol_en_proyecto
        FROM proyectos p
        JOIN dependencias d ON p.dependencia_id = d.id
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
            `SELECT p.*, d.nombre as dependencia_nombre, d.tipo as dependencia_tipo
       FROM proyectos p JOIN dependencias d ON p.dependencia_id = d.id
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
    const { nombre, dependencia_id, usuarios_ids, revisores_ids } = req.body;
    if (!nombre || !dependencia_id)
        return res.status(400).json({ error: 'Nombre y dependencia son requeridos' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const proyResult = await client.query(
            `INSERT INTO proyectos (nombre, dependencia_id, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
            [nombre, dependencia_id, req.user.id]
        );
        const proyecto = proyResult.rows[0];

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
    const { id } = req.params;
    const { nombre, dependencia_id, estado, usuarios_ids, revisores_ids } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            `UPDATE proyectos SET nombre=$1, dependencia_id=$2, estado=$3, updated_at=NOW() WHERE id=$4`,
            [nombre, dependencia_id, estado, id]
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

module.exports = { listar, obtener, crear, actualizar, subirOrganigrama };
