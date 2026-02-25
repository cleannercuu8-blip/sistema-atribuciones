const pool = require('../config/db');

// GET /api/proyectos/:proyectoId/unidades  - árbol completo
const obtenerArbol = async (req, res) => {
    const { proyectoId } = req.params;
    try {
        const result = await pool.query(
            `SELECT * FROM unidades_administrativas
       WHERE proyecto_id = $1
       ORDER BY nivel_numero ASC, orden ASC, nombre ASC`,
            [proyectoId]
        );
        // Construir árbol jerárquico
        const todas = result.rows;
        const mapa = {};
        todas.forEach(u => { mapa[u.id] = { ...u, hijos: [] }; });
        const raices = [];
        todas.forEach(u => {
            if (u.padre_id && mapa[u.padre_id]) {
                mapa[u.padre_id].hijos.push(mapa[u.id]);
            } else if (!u.padre_id) {
                raices.push(mapa[u.id]);
            }
        });
        res.json(raices);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// GET /api/proyectos/:proyectoId/unidades/plana  - lista plana para selects
const obtenerPlana = async (req, res) => {
    const { proyectoId } = req.params;
    try {
        const result = await pool.query(
            `SELECT * FROM unidades_administrativas WHERE proyecto_id = $1 ORDER BY nivel_numero ASC, orden ASC`,
            [proyectoId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// POST /api/proyectos/:proyectoId/unidades
const crear = async (req, res) => {
    const { proyectoId } = req.params;
    const { nombre, siglas, nivel_numero, padre_id, orden } = req.body;
    if (!nombre || !siglas || nivel_numero === undefined)
        return res.status(400).json({ error: 'Nombre, siglas y nivel son requeridos' });

    try {
        // Verificar unicidad de siglas en el proyecto
        const siglaExiste = await pool.query(
            'SELECT id FROM unidades_administrativas WHERE proyecto_id = $1 AND LOWER(siglas) = LOWER($2)',
            [proyectoId, siglas]
        );
        if (siglaExiste.rows.length > 0)
            return res.status(400).json({ error: `Las siglas "${siglas}" ya existen en este proyecto` });

        const result = await pool.query(
            `INSERT INTO unidades_administrativas (proyecto_id, nombre, siglas, nivel_numero, padre_id, orden)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [proyectoId, nombre, siglas.toUpperCase(), nivel_numero, padre_id || null, orden || 0]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// PUT /api/unidades/:id
const actualizar = async (req, res) => {
    const { id } = req.params;
    const { nombre, siglas, padre_id, orden } = req.body;
    try {
        const result = await pool.query(
            `UPDATE unidades_administrativas SET nombre=$1, siglas=$2, padre_id=$3, orden=$4
       WHERE id=$5 RETURNING *`,
            [nombre, siglas.toUpperCase(), padre_id || null, orden || 0, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrada' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// DELETE /api/unidades/:id
const eliminar = async (req, res) => {
    const { id } = req.params;
    try {
        const tieneHijos = await pool.query(
            'SELECT id FROM unidades_administrativas WHERE padre_id = $1', [id]
        );
        if (tieneHijos.rows.length > 0)
            return res.status(400).json({ error: 'No se puede eliminar, tiene unidades subordinadas' });

        await pool.query('DELETE FROM unidades_administrativas WHERE id = $1', [id]);
        res.json({ mensaje: 'Unidad eliminada' });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

module.exports = { obtenerArbol, obtenerPlana, crear, actualizar, eliminar };
