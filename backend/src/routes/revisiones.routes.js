const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/revisiones.controller');
const { authMiddleware, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads/productos'));
    },
    filename: (req, file, cb) => {
        cb(null, `producto_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos Word (.docx)'), false);
        }
    }
});

router.use(authMiddleware);

router.get('/:id/observaciones', ctrl.listarObservaciones);
router.post('/:id/observaciones', requireRole('revisor', 'admin'), ctrl.crearObservacion);
router.put('/:id/cerrar', requireRole('revisor', 'admin'), ctrl.cerrarRevision);
router.put('/observaciones/:id/subsanar', ctrl.subsanarObservacion);
router.post('/:id/producto-final', requireRole('revisor', 'admin'), upload.single('archivo'), ctrl.subirProductoFinal);

module.exports = router;
