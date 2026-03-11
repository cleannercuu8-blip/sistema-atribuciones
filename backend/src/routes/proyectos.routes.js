const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const ctrl = require('../controllers/proyectos.controller');
const unidadesCtrl = require('../controllers/unidades.controller');
const atribCtrl = require('../controllers/atribuciones.controller');
const revCtrl = require('../controllers/revisiones.controller');
const emailService = require('../services/email.service');
const excelService = require('../services/excel.service');
const excelRevCtrl = require('../controllers/revisiones-excel.controller');
const { authMiddleware, requireRole } = require('../middleware/auth');
const pool = require('../config/db');

// Configurar multer para PDFs
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads/organigramas'));
    },
    filename: (req, file, cb) => {
        cb(null, `proy-${req.params.id}-${Date.now()}.pdf`);
    }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// Configurar multer para Excel
const storageExcel = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads')); // Guardar en uploads temporalmente
    },
    filename: (req, file, cb) => {
        cb(null, `revision-${req.params.proyectoId}-${Date.now()}.xlsx`);
    }
});
const uploadExcel = multer({ storage: storageExcel, limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authMiddleware);

// === PROYECTOS ===
router.get('/', ctrl.listar);
router.post('/', requireRole('admin', 'revisor'), ctrl.crear);
router.get('/:id', ctrl.obtener);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);
router.post('/:id/organigrama', upload.single('archivo'), ctrl.subirOrganigrama);
router.put('/:proyectoId/aprobar', requireRole('admin', 'revisor'), revCtrl.aprobarProyecto);

// === GLOSARIO ===
router.get('/:proyectoId/glosario', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM glosario WHERE proyecto_id = $1 ORDER BY acronimo',
            [req.params.proyectoId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.post('/:proyectoId/glosario', async (req, res) => {
    const { acronimo, significado } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO glosario (proyecto_id, acronimo, significado) VALUES ($1,$2,$3) RETURNING *',
            [req.params.proyectoId, acronimo, significado]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.post('/:proyectoId/glosario/masivo', requireRole('admin', 'revisor'), async (req, res) => {
    const catalogosCtrl = require('../controllers/catalogos.controller');
    return catalogosCtrl.cargarMasivoGlosario(req, res);
});

router.delete('/:proyectoId/glosario/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM glosario WHERE id = $1 AND proyecto_id = $2', [req.params.id, req.params.proyectoId]);
        res.json({ mensaje: 'Eliminado' });
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// === UNIDADES ADMINISTRATIVAS ===
router.get('/:proyectoId/unidades', unidadesCtrl.obtenerArbol);
router.get('/:proyectoId/unidades/plana', unidadesCtrl.obtenerPlana);
router.post('/:proyectoId/unidades', unidadesCtrl.crear);
router.post('/:proyectoId/unidades/masivo', unidadesCtrl.cargarMasivoUnidades);

// === ATRIBUCIONES GENERALES ===
router.get('/:proyectoId/atribuciones-generales', atribCtrl.listar);
router.post('/:proyectoId/atribuciones-generales', atribCtrl.crear);
router.post('/:proyectoId/atribuciones-generales/masivo', atribCtrl.cargarMasivoGenerales);

// === ATRIBUCIONES ESPECÍFICAS ===
router.get('/:proyectoId/atribuciones-especificas', atribCtrl.listarEspecificas);
router.post('/:proyectoId/atribuciones-especificas', atribCtrl.crearEspecifica);

// === REVISIONES ===
router.get('/:proyectoId/revisiones', revCtrl.listar);
router.post('/:proyectoId/revisiones', requireRole('revisor', 'admin'), revCtrl.crear);

// === EXPORTAR EXCEL ===
router.get('/:proyectoId/exportar', async (req, res) => {
    try {
        const workbook = await excelService.exportarExcel(req.params.proyectoId);
        const proyResult = await pool.query('SELECT nombre FROM proyectos WHERE id = $1', [req.params.proyectoId]);
        const nombre = proyResult.rows[0]?.nombre || 'proyecto';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="atribuciones-${nombre.replace(/\s/g, '-')}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al generar el Excel' });
    }
});

// === REVISIÓN POR EXCEL ===
router.get('/:proyectoId/revision-excel/exportar', excelRevCtrl.exportarExcel);
router.get('/:proyectoId/revision-excel/historial', excelRevCtrl.listarHistorial);
router.delete('/:proyectoId/revision-excel/historial/:id', excelRevCtrl.eliminarHistorial);
router.put('/:proyectoId/revision-excel/historial/:id', excelRevCtrl.actualizarHistorial);
router.get('/:proyectoId/revision-excel/descargar/:archivoUrl', excelRevCtrl.descargarArchivo);
router.post('/:proyectoId/revision-excel/importar', uploadExcel.single('archivo'), excelRevCtrl.importarExcel);
router.post('/:proyectoId/revision-excel/aplicar', requireRole('admin', 'revisor'), excelRevCtrl.aplicarCambios);

// === EXPORTAR WORD ===
router.get('/:id/exportar-word', ctrl.exportarWord);

module.exports = router;

