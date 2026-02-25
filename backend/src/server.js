require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// ============================================
// MIDDLEWARES GLOBALES
// ============================================
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de Logging para detectar el 404
app.use((req, res, next) => {
    console.log(`📡 Recibida petición: ${req.method} ${req.url}`);
    next();
});

// Crear directorio de uploads si no existe
const uploadsDir = path.join(__dirname, '../uploads/organigramas');
const productosDir = path.join(__dirname, '../uploads/productos');
[uploadsDir, productosDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Servir PDFs de organigramas
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// INICIALIZAR BASE DE DATOS
// ============================================
const pool = require('./config/db');
const schemaPath = path.join(__dirname, './config/schema.sql');

const initDB = async () => {
    try {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('✅ Esquema de BD inicializado correctamente');

        // Migración de columnas nuevas para Proyectos
        await pool.query(`
            ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS responsable VARCHAR(255);
            ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS enlaces TEXT;
            ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS fecha_expediente DATE;
            ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS avance_id INTEGER REFERENCES cat_avances(id);
        `);

        // Tablas de Catálogos
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cat_responsables (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL UNIQUE,
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS cat_enlaces (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS cat_avances (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL UNIQUE,
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('🔹 Migración de tablas de catálogos completada');

        // Migración para documentos de Word en Revisiones
        await pool.query(`
            ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS producto_word VARCHAR(255);
        `);
        console.log('🔹 Migración de soporte para Word completada');
    } catch (err) {
        console.error('❌ Error al inicializar BD:', err.message);
    }
};

// La inicialización automática estaba causando reinicios lentos
// Solo se ejecutará si se define la variable de entorno DB_INIT=true
if (process.env.DB_INIT === 'true') {
    console.log('🛠️ Iniciando limpieza y recreación de BD...');
    initDB();
} else {
    console.log('✅ Saltando inicialización automática de BD (Ambiente estable)');
}

// ============================================
// RUTAS API
// ============================================
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/usuarios', require('./routes/usuarios.routes'));
app.use('/api/dependencias', require('./routes/dependencias.routes'));
app.use('/api/proyectos', require('./routes/proyectos.routes'));
app.use('/api/revisiones', require('./routes/revisiones.routes'));
app.use('/api/unidades', require('./routes/unidades.routes'));
app.use('/api/atribuciones-generales', require('./routes/atribuciones.routes'));
app.use('/api/catalogos', require('./routes/catalogos.routes'));

// Configuración de email (solo admin)
const emailService = require('./services/email.service');
const { authMiddleware, requireRole } = require('./middleware/auth');
app.get('/api/admin/email-config', authMiddleware, requireRole('admin'), emailService.obtenerConfig);
app.put('/api/admin/email-config', authMiddleware, requireRole('admin'), emailService.actualizarConfig);

// Health check para Render
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '1.1-debug',
        timestamp: new Date().toISOString()
    });
});

// Ruta raíz
app.get('/', (req, res) => {
    res.json({ mensaje: 'Sistema de Atribuciones API v1.0', status: 'activo' });
});

// Manejador de rutas no encontradas (404)
app.use((req, res) => {
    console.log(`⚠️ Ruta no encontrada: ${req.method} ${req.url}`);
    res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.url}` });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor', detalle: err.message });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
