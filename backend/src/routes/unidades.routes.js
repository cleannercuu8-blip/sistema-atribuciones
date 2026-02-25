const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/unidades.controller');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
