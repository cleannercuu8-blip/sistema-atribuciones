const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authMiddleware } = require('../middleware/auth');

// Todas las rutas del dashboard requieren autenticación
router.get('/innovations', authMiddleware, dashboardController.getStatsInnovadoras);

module.exports = router;
