const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/revisiones.controller');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/:id/observaciones', ctrl.listarObservaciones);
router.post('/:id/observaciones', requireRole('revisor', 'admin'), ctrl.crearObservacion);
router.put('/:id/cerrar', requireRole('revisor', 'admin'), ctrl.cerrarRevision);
router.put('/observaciones/:id/subsanar', ctrl.subsanarObservacion);

module.exports = router;
