const pool = require('../config/db');
const ExcelJS = require('exceljs');

const listarResponsables = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cat_responsables ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar responsables' });
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

const listarAvances = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cat_avances ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar avances' });
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
        for (const item of items) {
            if (!item.nombre || !item.email) continue;
            await client.query(
                'INSERT INTO cat_enlaces (nombre, email) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre',
                [item.nombre, item.email]
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
            await client.query(
                'INSERT INTO dependencias (nombre, tipo) VALUES ($1, $2) ON CONFLICT (nombre) DO UPDATE SET tipo = EXCLUDED.tipo',
                [item.nombre, item.tipo]
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

const limpiarCatalogo = async (req, res) => {
    const { tipo } = req.params;
    const mapaTablas = {
        'responsables': 'cat_responsables',
        'enlaces': 'cat_enlaces',
        'avances': 'cat_avances',
        'dependencias': 'dependencias'
    };

    const tabla = mapaTablas[tipo];
    if (!tabla) return res.status(400).json({ error: 'Tipo de catálogo inválido' });

    try {
        await pool.query(`TRUNCATE TABLE ${tabla} RESTART IDENTITY CASCADE`);
        res.json({ mensaje: `Catálogo de ${tipo} limpiado correctamente` });
    } catch (err) {
        res.status(500).json({ error: 'Error al limpiar catálogo' });
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

module.exports = {
    listarResponsables,
    listarEnlaces,
    listarAvances,
    listarDependencias,
    cargarMasivoResponsables,
    cargarMasivoEnlaces,
    cargarMasivoAvances,
    cargarMasivoDependencias,
    limpiarCatalogo,
    descargarPlantilla
};
