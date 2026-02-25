const express = require('express');
const router = express.Router();
const catalogosController = require('../controllers/catalogos.controller');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Listar (Disponible para todos los autenticados para que puedan usar los selectores)
router.get('/responsables', authMiddleware, catalogosController.listarResponsables);
router.get('/enlaces', authMiddleware, catalogosController.listarEnlaces);

// Gestión (Solo Admin)
router.post('/responsables/masivo', authMiddleware, requireRole('admin'), catalogosController.cargarMasivoResponsables);
router.post('/enlaces/masivo', authMiddleware, requireRole('admin'), catalogosController.cargarMasivoEnlaces);
router.delete('/:tipo/limpiar', authMiddleware, requireRole('admin'), catalogosController.limpiarCatalogo);
router.get('/plantilla/:tipo', authMiddleware, requireRole('admin'), catalogosController.descargarPlantilla);

module.exports = router;
