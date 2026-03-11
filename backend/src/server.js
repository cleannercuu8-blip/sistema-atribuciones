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
const revisionesDir = path.join(__dirname, '../uploads/revisiones');
[uploadsDir, productosDir, revisionesDir].forEach(dir => {
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

/**
 * Inicialización completa de la base de datos (Ejecuta el schema.sql)
 * Se usa solo cuando DB_INIT=true para recrear/asegurar la estructura.
 */
const initDB = async () => {
    try {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('✅ Esquema de BD (schema.sql) aplicado correctamente.');

        // Mantener las migraciones de limpieza de dependencias que estaban en el controller
        await pool.query(`
            DO $$ 
            BEGIN 
                DELETE FROM dependencias d
                WHERE d.id > (
                    SELECT MIN(id) FROM dependencias d2 
                    WHERE d2.nombre = d.nombre
                );
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dependencias_nombre_key') THEN
                    ALTER TABLE dependencias ADD CONSTRAINT dependencias_nombre_key UNIQUE (nombre);
                END IF;
            END $$;
        `);
        console.log('🔹 Restricción UNIQUE en dependencias verificada.');
    } catch (err) {
        console.error('❌ Error al inicializar BD:', err.message);
    }
};

/**
 * Migraciones esenciales que SIEMPRE deben ejecutarse para asegurar la integridad de la BD
 */
const runEssentialMigrations = async () => {
    try {
        console.log('🚀 Ejecutando comprobación de esquema y migraciones esenciales...');

        await pool.query(`
            -- 1. Extensiones y Tipos
            CREATE EXTENSION IF NOT EXISTS "pgcrypto";

            -- 2. Tablas Base y Catálogos
            CREATE TABLE IF NOT EXISTS cat_estados_proyecto (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL UNIQUE,
                color VARCHAR(20) DEFAULT '#475569',
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS cat_responsables (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(200) NOT NULL UNIQUE,
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS cat_enlaces (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(200) NOT NULL,
                email VARCHAR(200) NOT NULL UNIQUE,
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS cat_avances (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL UNIQUE,
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS actividades (
                id SERIAL PRIMARY KEY,
                tipo VARCHAR(50) NOT NULL,
                entidad VARCHAR(50),
                entidad_id INTEGER,
                proyecto_id INTEGER,
                mensaje TEXT NOT NULL,
                autor VARCHAR(200),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS historial_revisiones_excel (
                id SERIAL PRIMARY KEY,
                proyecto_id INTEGER NOT NULL,
                nombre_archivo VARCHAR(255),
                total_cambios INTEGER DEFAULT 0,
                cambios_aplicados INTEGER DEFAULT 0,
                usuario_nombre VARCHAR(200),
                resumen_cambios JSONB,
                archivo_url TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            -- 3. Migraciones de Columnas Existentes
            ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS estado_id INTEGER REFERENCES cat_estados_proyecto(id);
            ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS responsable_apoyo TEXT;
            ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS avance_id INTEGER REFERENCES cat_avances(id);
            ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS enlaces TEXT;
            ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS fecha_expediente DATE;
            ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS responsable VARCHAR(200);
            
            ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(50) DEFAULT 'revisor';
            
            ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS producto_word VARCHAR(255);
            
            ALTER TABLE observaciones 
            ADD COLUMN IF NOT EXISTS valor_original TEXT,
            ADD COLUMN IF NOT EXISTS valor_subsanado TEXT;

            ALTER TABLE atribuciones_especificas 
            ADD COLUMN IF NOT EXISTS corresponsabilidad TEXT,
            ADD COLUMN IF NOT EXISTS responsable_id INTEGER,
            ADD COLUMN IF NOT EXISTS apoyo_ids INTEGER[];

            -- 4. Restricciones de Unicidad
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'glosario_proyecto_acronimo_key') THEN
                    ALTER TABLE glosario ADD CONSTRAINT glosario_proyecto_acronimo_key UNIQUE (proyecto_id, acronimo);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atribuciones_generales_proyecto_clave_key') THEN
                    ALTER TABLE atribuciones_generales ADD CONSTRAINT atribuciones_generales_proyecto_clave_key UNIQUE (proyecto_id, clave);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dependencias_nombre_key') THEN
                    ALTER TABLE dependencias ADD CONSTRAINT dependencias_nombre_key UNIQUE (nombre);
                END IF;
            END $$;
        `);

        // Insertar estados por defecto si la tabla está vacía
        const cnt = await pool.query('SELECT count(*) FROM cat_estados_proyecto');
        if (parseInt(cnt.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO cat_estados_proyecto (nombre, color) VALUES
                ('Activo', '#22c55e'),
                ('En Pausa', '#f59e0b'),
                ('Cerrado por inactividad', '#ef4444'),
                ('Dictaminado', '#3b82f6'),
                ('Borrador', '#64748b')
                ON CONFLICT (nombre) DO NOTHING;
            `);
        }

        // Insertar avances por defecto si la tabla está vacía
        const cntAv = await pool.query('SELECT count(*) FROM cat_avances');
        if (parseInt(cntAv.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO cat_avances (nombre) VALUES
                ('Iniciado'), ('En Proceso'), ('En Revisión'), ('Finalizado')
                ON CONFLICT (nombre) DO NOTHING;
            `);
        }

        // Insertar dependencias de ejemplo si la tabla está vacía
        const cntDep = await pool.query('SELECT count(*) FROM dependencias');
        if (parseInt(cntDep.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO dependencias (nombre, tipo) VALUES
                ('Secretaría de Función Pública', 'centralizada'),
                ('Secretaría de Hacienda', 'centralizada'),
                ('Instituto de Innovación', 'paraestatal')
                ON CONFLICT (nombre) DO NOTHING;
            `);
        }

        // Insertar responsables por defecto si la tabla está vacía
        const cntResp = await pool.query('SELECT count(*) FROM cat_responsables');
        if (parseInt(cntResp.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO cat_responsables (nombre) VALUES
                ('Coordinación de Atribuciones'),
                ('Dirección de Innovación'),
                ('Subsecretaría Jurídica'),
                ('Administrador del Sistema')
                ON CONFLICT (nombre) DO NOTHING;
            `);
        }

        // Insertar enlaces por defecto si la tabla está vacía
        const cntEn = await pool.query('SELECT count(*) FROM cat_enlaces');
        if (parseInt(cntEn.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO cat_enlaces (nombre, email) VALUES
                ('Admin Sistema', 'admin@atribuciones.gob'),
                ('Enlace Institucional', 'enlace@ejemplo.com')
                ON CONFLICT (email) DO NOTHING;
            `);
        }

        console.log('✅ Esquema y migraciones verificadas.');
    } catch (err) {
        console.error('⚠️ Error en verificación de BD:', err.message);
    }
};

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
app.use('/api/dashboard', require('./routes/dashboard.routes'));

// Configuración de email (solo admin)
const emailService = require('./services/email.service');
const { authMiddleware, requireRole } = require('./middleware/auth');
app.get('/api/admin/email-config', authMiddleware, requireRole('admin'), emailService.obtenerConfig);
app.put('/api/admin/email-config', authMiddleware, requireRole('admin'), emailService.actualizarConfig);

// DB Check para diagnóstico
app.get('/api/db-check', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as time');
        res.json({ status: 'ok', time: result.rows[0].time });
    } catch (err) {
        console.error('❌ Error de conexión DB en /api/db-check:', err);
        res.status(500).json({ status: 'error', message: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
    }
});

// Health check para Render
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '1.2-resilience',
        timestamp: new Date().toISOString()
    });
});

// Ruta raíz
app.get('/', (req, res) => {
    res.json({ mensaje: 'Sistema de Atribuciones API v1.0', status: 'activo' });
});

app.get('/api/check-file', (req, res) => {
    const filename = req.query.name;
    if (!filename) return res.json({ error: 'Falta name' });
    const fullPath = path.join(__dirname, '../uploads/revisiones', filename);
    const exists = fs.existsSync(fullPath);
    let size = 0;
    if (exists) {
        size = fs.statSync(fullPath).size;
    }
    const dirList = fs.existsSync(path.join(__dirname, '../uploads/revisiones')) 
        ? fs.readdirSync(path.join(__dirname, '../uploads/revisiones')) 
        : [];
    res.json({ filename, exists, size, dirList });
});

// Manejador de rutas no encontradas (404)
app.use((req, res) => {
    console.log(`⚠️ Ruta no encontrada: ${req.method} ${req.url}`);
    res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.url}` });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('❌ ERROR GLOBAL:', err);
    res.status(err.status || 500).json({
        error: 'Error interno del servidor',
        detalle: err.message,
        path: req.url
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3001;

const startServer = async () => {
    try {
        // En Render, es mejor abrir el puerto RÁPIDO para evitar el Port scan timeout
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
            console.log(`   Ambiente: ${process.env.NODE_ENV || 'production'}`);
        });

        // Una vez abierto el puerto, hacemos el bootstrap de la BD en segundo plano
        // pero de forma más controlada.
        if (process.env.DB_INIT === 'true') {
            console.log('🛠️ DB_INIT activa: Ejecutando inicialización completa...');
            await initDB();
        } else {
            // Siempre ejecutamos las migraciones esenciales pero de forma atómica
            await runEssentialMigrations();
        }

    } catch (err) {
        console.error('❌ Error fatal al iniciar servidor:', err);
        process.exit(1);
    }
};

startServer();

module.exports = app;
