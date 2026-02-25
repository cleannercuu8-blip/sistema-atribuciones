const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dependencias.controller');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware);
router.get('/', ctrl.listar);
router.post('/', requireRole('admin'), ctrl.crear);
router.put('/:id', requireRole('admin'), ctrl.actualizar);

module.exports = router;
