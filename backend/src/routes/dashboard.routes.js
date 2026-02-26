const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const auth = require('../middleware/auth');

// Todas las rutas del dashboard requieren autenticación
router.get('/innovations', auth, dashboardController.getStatsInnovadoras);

module.exports = router;
