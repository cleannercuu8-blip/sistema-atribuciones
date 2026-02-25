const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth');

router.post('/login', ctrl.login);
router.get('/me', authMiddleware, ctrl.me);
router.put('/cambiar-password', authMiddleware, ctrl.cambiarPassword);

module.exports = router;
