const pool = require('../config/db');

// GET /api/proyectos/:proyectoId/atribuciones-generales
const listar = async (req, res) => {
    const { proyectoId } = req.params;
    try {
        const result = await pool.query(
            `SELECT * FROM atribuciones_generales WHERE proyecto_id = $1 AND activo = true ORDER BY clave`,
            [proyectoId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// POST /api/proyectos/:proyectoId/atribuciones-generales
const crear = async (req, res) => {
    const { proyectoId } = req.params;
    const { clave, norma, articulo, fraccion_parrafo, texto } = req.body;
    if (!clave || !texto) return res.status(400).json({ error: 'Clave y texto son requeridos' });
    try {
        const result = await pool.query(
            `INSERT INTO atribuciones_generales (proyecto_id, clave, norma, articulo, fraccion_parrafo, texto)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [proyectoId, clave, norma, articulo, fraccion_parrafo, texto]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// PUT /api/atribuciones-generales/:id
const actualizar = async (req, res) => {
    const { id } = req.params;
    const { clave, norma, articulo, fraccion_parrafo, texto } = req.body;
    try {
        const result = await pool.query(
            `UPDATE atribuciones_generales SET clave=$1, norma=$2, articulo=$3, fraccion_parrafo=$4, texto=$5 WHERE id=$6 RETURNING *`,
            [clave, norma, articulo, fraccion_parrafo, texto, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// DELETE /api/atribuciones-generales/:id
const eliminar = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE atribuciones_generales SET activo = false WHERE id = $1', [id]);
        res.json({ mensaje: 'Eliminada correctamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// =============================================
// ATRIBUCIONES ESPECÍFICAS
// =============================================

// GET /api/proyectos/:proyectoId/atribuciones-especificas
const listarEspecificas = async (req, res) => {
    const { proyectoId } = req.params;
    const { unidad_id } = req.query;
    try {
        let query = `
      SELECT ae.*, ua.nombre as unidad_nombre, ua.siglas as unidad_siglas, ua.nivel_numero,
             ag.clave as gen_clave, ag.texto as gen_texto,
             ae2.clave as padre_clave, ae2.texto as padre_texto,
             u.nombre as responsable_nombre,
             (SELECT ARRAY_AGG(nombre) FROM usuarios WHERE id = ANY(ae.apoyo_ids)) as apoyo_nombres
      FROM atribuciones_especificas ae
      JOIN unidades_administrativas ua ON ae.unidad_id = ua.id
      LEFT JOIN atribuciones_generales ag ON ae.atribucion_general_id = ag.id
      LEFT JOIN atribuciones_especificas ae2 ON ae.padre_atribucion_id = ae2.id
      LEFT JOIN usuarios u ON ae.responsable_id = u.id
      WHERE ae.proyecto_id = $1 AND ae.activo = true`;
        const params = [proyectoId];
        if (unidad_id) {
            query += ` AND ae.unidad_id = $2`;
            params.push(unidad_id);
        }
        query += ` ORDER BY ua.nivel_numero ASC, ae.clave ASC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// GET /api/atribuciones/especificas/todas
const listarTodasEspecificas = async (req, res) => {
    try {
        const query = `
      SELECT ae.*, ua.nombre as unidad_nombre, ua.siglas as unidad_siglas, p.nombre as proyecto_nombre,
             u.nombre as responsable_nombre,
             (SELECT ARRAY_AGG(nombre) FROM usuarios WHERE id = ANY(ae.apoyo_ids)) as apoyo_nombres
      FROM atribuciones_especificas ae
      JOIN unidades_administrativas ua ON ae.unidad_id = ua.id
      JOIN proyectos p ON ae.proyecto_id = p.id
      LEFT JOIN usuarios u ON ae.responsable_id = u.id
      WHERE ae.activo = true
      ORDER BY p.nombre ASC, ua.nivel_numero ASC, ae.clave ASC`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// POST /api/proyectos/:proyectoId/atribuciones-especificas
const crearEspecifica = async (req, res) => {
    const { proyectoId } = req.params;
    const { unidad_id, clave, texto, tipo, padre_atribucion_id, atribucion_general_id, corresponsabilidad, responsable_id, apoyo_ids } = req.body;
    if (!unidad_id || !clave || !texto)
        return res.status(400).json({ error: 'Unidad, clave y texto son requeridos' });
    try {
        const result = await pool.query(
            `INSERT INTO atribuciones_especificas (proyecto_id, unidad_id, clave, texto, tipo, padre_atribucion_id, atribucion_general_id, corresponsabilidad, responsable_id, apoyo_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [proyectoId, unidad_id, clave, texto, tipo || 'normal', padre_atribucion_id || null, atribucion_general_id || null, corresponsabilidad || null, responsable_id || null, apoyo_ids || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// PUT /api/atribuciones-especificas/:id
const actualizarEspecifica = async (req, res) => {
    const { id } = req.params;
    const { clave, texto, tipo, padre_atribucion_id, atribucion_general_id, corresponsabilidad, responsable_id, apoyo_ids } = req.body;
    try {
        const result = await pool.query(
            `UPDATE atribuciones_especificas
       SET clave=$1, texto=$2, tipo=$3, padre_atribucion_id=$4, atribucion_general_id=$5, corresponsabilidad=$6, responsable_id=$7, apoyo_ids=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
            [clave, texto, tipo || 'normal', padre_atribucion_id || null, atribucion_general_id || null, corresponsabilidad || null, responsable_id || null, apoyo_ids || null, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// DELETE /api/atribuciones-especificas/:id
const eliminarEspecifica = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE atribuciones_especificas SET activo = false WHERE id = $1', [id]);
        res.json({ mensaje: 'Eliminada correctamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

const cargarMasivoGenerales = async (req, res) => {
    const { proyectoId } = req.params;
    const { items } = req.body; // [{clave, norma, articulo, fraccion_parrafo, texto}]
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Formato inválido' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const item of items) {
            if (!item.clave || !item.texto) continue;
            await client.query(
                `INSERT INTO atribuciones_generales (proyecto_id, clave, norma, articulo, fraccion_parrafo, texto)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [proyectoId, item.clave, item.norma || null, item.articulo || null, item.fraccion_parrafo || null, item.texto]
            );
        }
        await client.query('COMMIT');
        res.json({ mensaje: 'Carga masiva de ley completada' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Error en la carga masiva' });
    } finally {
        client.release();
    }
};

module.exports = {
    listar, crear, actualizar, eliminar, cargarMasivoGenerales,
    listarEspecificas, listarTodasEspecificas, crearEspecifica, actualizarEspecifica, eliminarEspecifica
};
