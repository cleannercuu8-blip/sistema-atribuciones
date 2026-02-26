const express = require('express');
const router = express.Router();
const catalogosController = require('../controllers/catalogos.controller');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Listar (Disponible para todos los autenticados para que puedan usar los selectores)
router.get('/responsables', authMiddleware, catalogosController.listarResponsables);
router.get('/enlaces', authMiddleware, catalogosController.listarEnlaces);
router.get('/avances', authMiddleware, catalogosController.listarAvances);
router.get('/dependencias', authMiddleware, catalogosController.listarDependencias);
router.get('/estados-proyecto', authMiddleware, catalogosController.listarEstadosProyecto);

// Gestión (Solo Admin)
router.post('/responsables', authMiddleware, requireRole('admin'), catalogosController.agregarResponsable);
router.put('/responsables/:id', authMiddleware, requireRole('admin'), catalogosController.actualizarResponsable);
router.delete('/responsables/:id', authMiddleware, requireRole('admin'), catalogosController.eliminarResponsable);

router.post('/enlaces', authMiddleware, requireRole('admin'), catalogosController.agregarEnlace);
router.put('/enlaces/:id', authMiddleware, requireRole('admin'), catalogosController.actualizarEnlace);
router.delete('/enlaces/:id', authMiddleware, requireRole('admin'), catalogosController.eliminarEnlace);

router.post('/avances', authMiddleware, requireRole('admin'), catalogosController.agregarAvance);
router.put('/avances/:id', authMiddleware, requireRole('admin'), catalogosController.actualizarAvance);
router.delete('/avances/:id', authMiddleware, requireRole('admin'), catalogosController.eliminarAvance);

router.post('/dependencias', authMiddleware, requireRole('admin'), catalogosController.agregarDependencia);
router.put('/dependencias/:id', authMiddleware, requireRole('admin'), catalogosController.actualizarDependencia);
router.delete('/dependencias/:id', authMiddleware, requireRole('admin'), catalogosController.eliminarDependencia);

router.post('/estados-proyecto', authMiddleware, requireRole('admin'), catalogosController.agregarEstadoProyecto);
router.put('/estados-proyecto/:id', authMiddleware, requireRole('admin'), catalogosController.actualizarEstadoProyecto);
router.delete('/estados-proyecto/:id', authMiddleware, requireRole('admin'), catalogosController.eliminarEstadoProyecto);

router.post('/responsables/masivo', authMiddleware, requireRole('admin'), catalogosController.cargarMasivoResponsables);
router.post('/enlaces/masivo', authMiddleware, requireRole('admin'), catalogosController.cargarMasivoEnlaces);
router.post('/avances/masivo', authMiddleware, requireRole('admin'), catalogosController.cargarMasivoAvances);
router.post('/dependencias/masivo', authMiddleware, requireRole('admin'), catalogosController.cargarMasivoDependencias);
router.delete('/:tipo/limpiar', authMiddleware, requireRole('admin'), catalogosController.limpiarCatalogo);
router.get('/plantilla/:tipo', authMiddleware, requireRole('admin'), catalogosController.descargarPlantilla);

module.exports = router;
