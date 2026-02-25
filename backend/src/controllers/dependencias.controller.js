const pool = require('../config/db');

// GET /api/dependencias
const listar = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, nombre, siglas, tipo, descripcion, activo, created_at FROM dependencias WHERE activo = true ORDER BY nombre`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// POST /api/dependencias
const crear = async (req, res) => {
    const { nombre, siglas, tipo, descripcion } = req.body;
    if (!nombre || !tipo) return res.status(400).json({ error: 'Nombre y tipo son requeridos' });
    try {
        const result = await pool.query(
            `INSERT INTO dependencias (nombre, siglas, tipo, descripcion)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [nombre, siglas, tipo, descripcion]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// PUT /api/dependencias/:id
const actualizar = async (req, res) => {
    const { id } = req.params;
    const { nombre, siglas, tipo, descripcion, activo } = req.body;
    try {
        const result = await pool.query(
            `UPDATE dependencias SET nombre=$1, siglas=$2, tipo=$3, descripcion=$4, activo=$5 WHERE id=$6 RETURNING *`,
            [nombre, siglas, tipo, descripcion, activo, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrada' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

module.exports = { listar, crear, actualizar };
