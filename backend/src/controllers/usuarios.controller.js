const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// GET /api/usuarios
const listar = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, nombre, email, rol, activo, created_at FROM usuarios ORDER BY nombre`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// POST /api/usuarios
const crear = async (req, res) => {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password || !rol)
        return res.status(400).json({ error: 'Todos los campos son requeridos' });

    try {
        const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email.toLowerCase()]);
        if (existe.rows.length > 0)
            return res.status(400).json({ error: 'El email ya está registrado' });

        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, email, rol, activo, created_at`,
            [nombre, email.toLowerCase(), hash, rol]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// PUT /api/usuarios/:id
const actualizar = async (req, res) => {
    const { id } = req.params;
    const { nombre, email, rol, activo, password } = req.body;
    try {
        let query, params;
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            query = `UPDATE usuarios SET nombre=$1, email=$2, rol=$3, activo=$4, password_hash=$5, updated_at=NOW()
               WHERE id=$6 RETURNING id, nombre, email, rol, activo`;
            params = [nombre, email.toLowerCase(), rol, activo, hash, id];
        } else {
            query = `UPDATE usuarios SET nombre=$1, email=$2, rol=$3, activo=$4, updated_at=NOW()
               WHERE id=$5 RETURNING id, nombre, email, rol, activo`;
            params = [nombre, email.toLowerCase(), rol, activo, id];
        }
        const result = await pool.query(query, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// DELETE /api/usuarios/:id
const eliminar = async (req, res) => {
    const { id } = req.params;
    try {
        // Intentar borrado físico
        try {
            const result = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);
            if (result.rows.length > 0) {
                return res.json({ mensaje: 'Usuario eliminado físicamente' });
            }
        } catch (dbErr) {
            // Si falla por FK (23503 es el código de error para violación de llave foránea en PG)
            if (dbErr.code === '23503') {
                await pool.query('UPDATE usuarios SET activo = false WHERE id = $1', [id]);
                return res.json({ mensaje: 'Usuario ocultado (tiene historial relacionado)' });
            }
            throw dbErr;
        }
        res.status(404).json({ error: 'Usuario no encontrado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

module.exports = { listar, crear, actualizar, eliminar };
