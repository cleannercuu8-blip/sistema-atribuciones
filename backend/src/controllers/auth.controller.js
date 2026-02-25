const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// POST /api/auth/login
const login = async (req, res) => {
    const { email, password } = req.body;
    console.log(`🔐 Intento de login para: ${email}`);
    if (!email || !password)
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });

    try {
        console.log(`🔍 Buscando usuario: ${email.toLowerCase()}`);
        const result = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1 AND activo = true',
            [email.toLowerCase()]
        );

        console.log(`📊 Usuarios encontrados: ${result.rows.length}`);

        if (result.rows.length === 0) {
            console.log(`⚠️ Login fallido: Usuario no existe o no está activo.`);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = result.rows[0];
        console.log(`🔐 Comparando contraseña para ID: ${user.id}`);

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            console.log(`⚠️ Login fallido: Contraseña incorrecta.`);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        console.log(`✅ Login exitoso para: ${user.email}`);
        const token = jwt.sign(
            { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            usuario: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
        });
    } catch (err) {
        console.error('❌ ERROR FATAL en Login Controller:', err);
        res.status(500).json({ error: 'Error del servidor', detalle: err.message });
    }
};

// GET /api/auth/me
const me = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, nombre, email, rol, created_at FROM usuarios WHERE id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// PUT /api/auth/cambiar-password
const cambiarPassword = async (req, res) => {
    const { password_actual, password_nuevo } = req.body;
    if (!password_actual || !password_nuevo)
        return res.status(400).json({ error: 'Datos incompletos' });

    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE id = $1', [req.user.id]);
        const user = result.rows[0];
        const valid = await bcrypt.compare(password_actual, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

        const hash = await bcrypt.hash(password_nuevo, 10);
        await pool.query('UPDATE usuarios SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
        res.json({ mensaje: 'Contraseña actualizada correctamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

module.exports = { login, me, cambiarPassword };
