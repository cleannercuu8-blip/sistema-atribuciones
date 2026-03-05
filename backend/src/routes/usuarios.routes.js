const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/usuarios.controller');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', ctrl.listar); // Permitir listar a todos los autenticados
router.post('/', requireRole('admin'), ctrl.crear);
router.put('/:id', requireRole('admin'), ctrl.actualizar);
router.delete('/:id', requireRole('admin'), ctrl.eliminar);

module.exports = router;
