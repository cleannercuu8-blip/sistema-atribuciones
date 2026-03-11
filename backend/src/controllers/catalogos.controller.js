const pool = require('../config/db');
const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');

const listarResponsables = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cat_responsables ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar responsables' });
    }
};

const obtenerResponsable = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cat_responsables WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

const listarEnlaces = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cat_enlaces ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar enlaces' });
    }
};

const obtenerEnlace = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM cat_enlaces WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Enlace no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error en obtenerEnlace:', err);
        res.status(500).json({ error: 'Error del servidor al obtener enlace', detalle: err.message });
    }
};

const listarAvances = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cat_avances ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar avances' });
    }
};

const obtenerAvance = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cat_avances WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

const listarDependencias = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM dependencias ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar dependencias' });
    }
};

const obtenerDependencia = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM dependencias WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

const cargarMasivoResponsables = async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Formato inválido' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const nombre of items) {
            if (!nombre) continue;
            await client.query(
                'INSERT INTO cat_responsables (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING',
                [nombre]
            );
        }
        await client.query('COMMIT');
        res.json({ mensaje: 'Carga masiva completada' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error en la carga masiva' });
    } finally {
        client.release();
    }
};

const cargarMasivoEnlaces = async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Formato inválido' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const defaultPassword = 'user123456'; // Contraseña por defecto para carga masiva
        const hash = await bcrypt.hash(defaultPassword, 10);

        for (const item of items) {
            if (!item.nombre || !item.email) continue;

            // Insertar o actualizar en catálogo de enlaces
            await client.query(
                `INSERT INTO cat_enlaces (nombre, email) 
                 VALUES ($1, $2) 
                 ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre`,
                [item.nombre, item.email.toLowerCase()]
            );

            // Crear usuario si no existe
            await client.query(
                `INSERT INTO usuarios (nombre, email, password_hash, rol)
                 VALUES ($1, $2, $3, 'enlace')
                 ON CONFLICT (email) DO NOTHING`,
                [item.nombre, item.email.toLowerCase(), hash]
            );
        }
        await client.query('COMMIT');
        res.json({ mensaje: 'Carga masiva completada y usuarios creados con contraseña: ' + defaultPassword });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error en carga masiva enlaces:', err);
        res.status(500).json({ error: 'Error en la carga masiva' });
    } finally {
        client.release();
    }
};

const cargarMasivoAvances = async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Formato inválido' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const nombre of items) {
            if (!nombre) continue;
            await client.query(
                'INSERT INTO cat_avances (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING',
                [nombre]
            );
        }
        await client.query('COMMIT');
        res.json({ mensaje: 'Carga masiva completada' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error en la carga masiva' });
    } finally {
        client.release();
    }
};

const cargarMasivoDependencias = async (req, res) => {
    const { items } = req.body; // items: [{nombre, tipo}]
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Formato inválido' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const item of items) {
            if (!item.nombre || !item.tipo) continue;

            // Normalización de tipos (manejar español y variaciones)
            let tipoNormalizado = String(item.tipo).toLowerCase().trim();
            if (tipoNormalizado.includes('dependencia') || tipoNormalizado === 'centralizada') tipoNormalizado = 'centralizada';
            else if (tipoNormalizado.includes('entidad') || tipoNormalizado === 'paraestatal') tipoNormalizado = 'paraestatal';
            else if (tipoNormalizado.includes('autónomo') || tipoNormalizado.includes('autonomo') || tipoNormalizado === 'organismo_autonomo') tipoNormalizado = 'organismo_autonomo';
            else tipoNormalizado = 'otro';

            await client.query(
                'INSERT INTO dependencias (nombre, tipo) VALUES ($1, $2) ON CONFLICT (nombre) DO UPDATE SET tipo = EXCLUDED.tipo',
                [item.nombre, tipoNormalizado]
            );
        }
        await client.query('COMMIT');
        res.json({ mensaje: 'Carga masiva completada' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error en la carga masiva' });
    } finally {
        client.release();
    }
};

const agregarResponsable = async (req, res) => {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    try {
        const result = await pool.query(
            'INSERT INTO cat_responsables (nombre) VALUES ($1) RETURNING *',
            [nombre]
        );
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'El responsable ya existe' });
        res.status(500).json({ error: 'Error al agregar responsable' });
    }
};

const agregarEnlace = async (req, res) => {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Insertar en catálogo de enlaces
        const resCat = await client.query(
            'INSERT INTO cat_enlaces (nombre, email) VALUES ($1, $2) RETURNING *',
            [nombre, email.toLowerCase()]
        );

        // 2. Crear usuario
        const hash = await bcrypt.hash(password, 10);
        await client.query(
            `INSERT INTO usuarios (nombre, email, password_hash, rol)
             VALUES ($1, $2, $3, 'enlace')`,
            [nombre, email.toLowerCase(), hash]
        );

        await client.query('COMMIT');
        res.json(resCat.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            return res.status(400).json({ error: 'El email ya existe en el catálogo o como usuario' });
        }
        console.error('Error al agregar enlace y usuario:', err);
        res.status(500).json({ error: 'Error al agregar enlace y crear usuario' });
    } finally {
        client.release();
    }
};

const agregarAvance = async (req, res) => {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    try {
        const result = await pool.query(
            'INSERT INTO cat_avances (nombre) VALUES ($1) RETURNING *',
            [nombre]
        );
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'El avance ya existe' });
        res.status(500).json({ error: 'Error al agregar avance' });
    }
};

const agregarDependencia = async (req, res) => {
    const { nombre, tipo } = req.body;
    if (!nombre || !tipo) return res.status(400).json({ error: 'Nombre y tipo requeridos' });
    try {
        const result = await pool.query(
            'INSERT INTO dependencias (nombre, tipo) VALUES ($1, $2) RETURNING *',
            [nombre, tipo]
        );
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'La dependencia ya existe' });
        res.status(500).json({ error: 'Error al agregar dependencia' });
    }
};

const limpiarCatalogo = async (req, res) => {
    const { tipo } = req.params;
    const mapaTablas = {
        'responsables': 'cat_responsables',
        'enlaces': 'cat_enlaces',
        'avances': 'cat_avances',
        'dependencias': 'dependencias',
        'estados-proyecto': 'cat_estados_proyecto'
    };

    const tabla = mapaTablas[tipo];
    if (!tabla) return res.status(400).json({ error: 'Tipo de catálogo inválido: ' + tipo });

    try {
        console.log(`🧹 Limpiando catálogo: ${tipo} (tabla: ${tabla})`);
        await pool.query(`TRUNCATE TABLE ${tabla} RESTART IDENTITY CASCADE`);
        res.json({ mensaje: `Catálogo de ${tipo} limpiado correctamente` });
    } catch (err) {
        console.error(`❌ Error al limpiar catálogo ${tipo}:`, err);
        res.status(500).json({ error: 'Error al limpiar catálogo', detalle: err.message });
    }
};

const descargarPlantilla = async (req, res) => {
    const { tipo } = req.params;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Plantilla');

    if (tipo === 'responsables') {
        worksheet.columns = [{ header: 'Nombre del Responsable', key: 'nombre', width: 40 }];
        worksheet.addRow(['Juan Pérez']);
    } else if (tipo === 'enlaces') {
        worksheet.columns = [
            { header: 'Nombre del Enlace', key: 'nombre', width: 40 },
            { header: 'Correo Electrónico', key: 'email', width: 40 }
        ];
        worksheet.addRow(['Ana Garcia', 'ana.garcia@ejemplo.com']);
    } else if (tipo === 'avances') {
        worksheet.columns = [{ header: 'Estado de Avance', key: 'nombre', width: 40 }];
        worksheet.addRow(['Iniciado']);
    } else if (tipo === 'dependencias') {
        worksheet.columns = [
            { header: 'Nombre de Dependencia', key: 'nombre', width: 40 },
            { header: 'Tipo (centralizada, paraestatal, organismo_autonomo)', key: 'tipo', width: 50 }
        ];
        worksheet.addRow(['Secretaría de Hacienda', 'centralizada']);
    } else {
        return res.status(400).json({ error: 'Tipo inválido' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=plantilla_${tipo}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
};

const actualizarResponsable = async (req, res) => {
    const { id } = req.params;
    const { nombre } = req.body;
    try {
        const result = await pool.query(
            'UPDATE cat_responsables SET nombre = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [nombre, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar responsable' });
    }
};

const eliminarResponsable = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM cat_responsables WHERE id = $1', [id]);
        res.json({ mensaje: 'Responsable eliminado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar responsable' });
    }
};

const actualizarEnlace = async (req, res) => {
    const { id } = req.params;
    const { nombre, email } = req.body;
    try {
        const result = await pool.query(
            'UPDATE cat_enlaces SET nombre = $1, email = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [nombre, email, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar enlace' });
    }
};

const eliminarEnlace = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM cat_enlaces WHERE id = $1', [id]);
        res.json({ mensaje: 'Enlace eliminado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar enlace' });
    }
};

const actualizarAvance = async (req, res) => {
    const { id } = req.params;
    const { nombre } = req.body;
    try {
        const result = await pool.query(
            'UPDATE cat_avances SET nombre = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [nombre, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar avance' });
    }
};

const eliminarAvance = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM cat_avances WHERE id = $1', [id]);
        res.json({ mensaje: 'Avance eliminado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar avance' });
    }
};

const actualizarDependencia = async (req, res) => {
    const { id } = req.params;
    const { nombre, tipo } = req.body;
    try {
        const result = await pool.query(
            'UPDATE dependencias SET nombre = $1, tipo = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [nombre, tipo, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar dependencia' });
    }
};

const eliminarDependencia = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM dependencias WHERE id = $1', [id]);
        res.json({ mensaje: 'Dependencia eliminada' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar dependencia' });
    }
};

// --- ESTADOS DE PROYECTO ---
const listarEstadosProyecto = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cat_estados_proyecto WHERE activo = true ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar estados de proyecto' });
    }
};

const agregarEstadoProyecto = async (req, res) => {
    const { nombre, color } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    try {
        const result = await pool.query(
            'INSERT INTO cat_estados_proyecto (nombre, color) VALUES ($1, $2) RETURNING *',
            [nombre, color || '#475569']
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al agregar estado' });
    }
};

const actualizarEstadoProyecto = async (req, res) => {
    const { id } = req.params;
    const { nombre, color } = req.body;
    try {
        const result = await pool.query(
            'UPDATE cat_estados_proyecto SET nombre = $1, color = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [nombre, color, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
};

const eliminarEstadoProyecto = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE cat_estados_proyecto SET activo = false WHERE id = $1', [id]);
        res.json({ mensaje: 'Estado desactivado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar estado' });
    }
};

const obtenerEstadoProyecto = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cat_estados_proyecto WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Estado no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error en obtenerEstadoProyecto:', err);
        res.status(500).json({ error: 'Error del servidor al obtener estado', detalle: err.message });
    }
};

const cargarMasivoEstadosProyecto = async (req, res) => {
    const { items } = req.body; // [{nombre, color}]
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Formato inválido' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const item of items) {
            if (!item.nombre) continue;
            
            await client.query(
                `INSERT INTO cat_estados_proyecto (nombre, color) 
                 VALUES ($1, $2) 
                 ON CONFLICT (nombre) DO UPDATE SET color = EXCLUDED.color`,
                [item.nombre, item.color || '#475569']
            );
        }
        await client.query('COMMIT');
        res.json({ mensaje: 'Carga masiva completada' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error en cargarMasivoEstadosProyecto:', err);
        res.status(500).json({ error: 'Error en la carga masiva' });
    } finally {
        client.release();
    }
};

const cargarMasivoGlosario = async (req, res) => {
    const { proyectoId } = req.params;
    const { items } = req.body; // [{acronimo, significado}]
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Formato inválido' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const item of items) {
            if (!item.acronimo || !item.significado) continue;
            await client.query(
                `INSERT INTO glosario (proyecto_id, acronimo, significado)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (proyecto_id, acronimo) DO UPDATE SET significado = EXCLUDED.significado`,
                [proyectoId, item.acronimo.toUpperCase(), item.significado]
            );
        }
        await client.query('COMMIT');
        res.json({ mensaje: 'Carga masiva de glosario completada' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Error en la carga masiva de glosario' });
    } finally {
        client.release();
    }
};

module.exports = {
    listarResponsables,
    listarEnlaces,
    listarAvances,
    listarDependencias,
    cargarMasivoResponsables,
    cargarMasivoEnlaces,
    cargarMasivoAvances,
    cargarMasivoDependencias,
    cargarMasivoGlosario,
    agregarResponsable,
    agregarEnlace,
    agregarAvance,
    agregarDependencia,
    actualizarResponsable,
    eliminarResponsable,
    actualizarEnlace,
    eliminarEnlace,
    actualizarAvance,
    eliminarAvance,
    actualizarDependencia,
    eliminarDependencia,
    listarEstadosProyecto,
    agregarEstadoProyecto,
    actualizarEstadoProyecto,
    eliminarEstadoProyecto,
    obtenerResponsable,
    obtenerEnlace,
    obtenerAvance,
    obtenerDependencia,
    obtenerEstadoProyecto,
    limpiarCatalogo,
    descargarPlantilla,
    cargarMasivoEstadosProyecto
};
