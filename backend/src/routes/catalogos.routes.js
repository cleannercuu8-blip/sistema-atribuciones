const express = require('express');
const router = express.Router();
const catalogosController = require('../controllers/catalogos.controller');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Listar (Disponible para todos los autenticados para que puedan usar los selectores)
router.get('/responsables', authMiddleware, catalogosController.listarResponsables);
router.get('/responsables/:id', authMiddleware, catalogosController.obtenerResponsable);
router.get('/enlaces', authMiddleware, catalogosController.listarEnlaces);
router.get('/enlaces/:id', authMiddleware, catalogosController.obtenerEnlace);
router.get('/avances', authMiddleware, catalogosController.listarAvances);
router.get('/avances/:id', authMiddleware, catalogosController.obtenerAvance);
router.get('/dependencias', authMiddleware, catalogosController.listarDependencias);
router.get('/dependencias/:id', authMiddleware, catalogosController.obtenerDependencia);
router.get('/estados-proyecto', authMiddleware, catalogosController.listarEstadosProyecto);

// Gestión (Solo Admin)
router.delete('/:tipo/limpiar', authMiddleware, requireRole('admin'), catalogosController.limpiarCatalogo);
router.get('/plantilla/:tipo', authMiddleware, requireRole('admin'), catalogosController.descargarPlantilla);

router.post('/responsables', authMiddleware, requireRole('admin'), catalogosController.agregarResponsable);
router.put('/responsables/:id', authMiddleware, requireRole('admin'), catalogosController.actualizarResponsable);
router.delete('/responsables/:id', authMiddleware, requireRole('admin'), catalogosController.eliminarResponsable);

router.post('/enlaces', authMiddleware, requireRole('admin'), catalogosController.agregarEnlace);
router.put('/enlaces/:id', authMiddleware, requireRole('admin'), catalogosController.actualizarEnlace);
router.delete('/enlaces/:id', authMiddleware, requireRole('admin'), catalogosController.eliminarEnlace);

router.post('/avances', authMiddleware, requireRole('admin'), catalogosController.agregarAvance);
router.put('/avances/:id', authMiddleware, requireRole('admin'), catalogosController.actualizarAvance);
router.post('/dependencias/masivo', authMiddleware, requireRole('admin'), catalogosController.cargarMasivoDependencias);
router.get('/estados-proyecto/:id', authMiddleware, catalogosController.obtenerEstadoProyecto);

module.exports = router;
