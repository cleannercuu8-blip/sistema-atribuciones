const express = require('express');
const router = express.Router();
const catalogosController = require('../controllers/catalogos.controller');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Listar (Disponible para todos los autenticados para que puedan usar los selectores)
router.get('/responsables', authMiddleware, catalogosController.listarResponsables);
router.get('/enlaces', authMiddleware, catalogosController.listarEnlaces);
router.get('/avances', authMiddleware, catalogosController.listarAvances);
router.get('/dependencias', authMiddleware, catalogosController.listarDependencias);

// Gestión (Solo Admin)
router.post('/responsables', authMiddleware, requireRole('admin'), catalogosController.agregarResponsable);
router.post('/enlaces', authMiddleware, requireRole('admin'), catalogosController.agregarEnlace);
router.post('/avances', authMiddleware, requireRole('admin'), catalogosController.agregarAvance);
router.post('/dependencias', authMiddleware, requireRole('admin'), catalogosController.agregarDependencia);

router.post('/responsables/masivo', authMiddleware, requireRole('admin'), catalogosController.cargarMasivoResponsables);
router.post('/enlaces/masivo', authMiddleware, requireRole('admin'), catalogosController.cargarMasivoEnlaces);
router.post('/avances/masivo', authMiddleware, requireRole('admin'), catalogosController.cargarMasivoAvances);
router.post('/dependencias/masivo', authMiddleware, requireRole('admin'), catalogosController.cargarMasivoDependencias);
router.delete('/:tipo/limpiar', authMiddleware, requireRole('admin'), catalogosController.limpiarCatalogo);
router.get('/plantilla/:tipo', authMiddleware, requireRole('admin'), catalogosController.descargarPlantilla);

module.exports = router;
