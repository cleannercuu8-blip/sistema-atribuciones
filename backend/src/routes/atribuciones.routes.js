const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/atribuciones.controller');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Rutas estáticas PRIMERO (antes de las paramétricas para evitar conflictos)
router.get('/especificas/todas', ctrl.listarTodasEspecificas);

// Rutas paramétricas
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

router.put('/especificas/:id', ctrl.actualizarEspecifica);
router.delete('/especificas/:id', ctrl.eliminarEspecifica);

module.exports = router;
