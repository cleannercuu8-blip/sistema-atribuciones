const excelRevService = require('../services/excel-revision.service');
const pool = require('../config/db');

exports.exportarExcel = async (req, res) => {
    try {
        const { proyectoId } = req.params;
        const workbook = await excelRevService.generarExcelRevision(proyectoId);

        const proyResult = await pool.query('SELECT nombre FROM proyectos WHERE id = $1', [proyectoId]);
        const nombre = proyResult.rows[0]?.nombre || 'proyecto';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="REVISION-${nombre.replace(/\s/g, '-')}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exportando Excel de revisión:', error);
        res.status(500).json({ error: 'Error al generar el documento de revisión' });
    }
};

exports.importarExcel = async (req, res) => {
    try {
        const { proyectoId } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        const fs = require('fs');
        const buffer = fs.readFileSync(file.path);

        const cambios = await excelRevService.analizarExcel(proyectoId, buffer);

        // Limpiamos el archivo temporal
        fs.unlinkSync(file.path);

        res.json({ cambios });
    } catch (error) {
        console.error('Error importando Excel:', error);
        res.status(500).json({ error: 'Error al procesar el documento Excel' });
    }
};

exports.aplicarCambios = async (req, res) => {
    try {
        const { proyectoId } = req.params;
        const { cambios } = req.body;

        if (!cambios || !Array.isArray(cambios)) {
            return res.status(400).json({ error: 'Formato de cambios inválido' });
        }

        await pool.query('BEGIN');

        for (const cambio of cambios) {
            await pool.query(
                'UPDATE atribuciones_especificas SET texto = $1, updated_at = NOW() WHERE id = $2 AND proyecto_id = $3',
                [cambio.texto_propuesto, cambio.id, proyectoId]
            );
        }

        // Marcar proyecto en revisión/subsanado
        await pool.query('UPDATE proyectos SET estado = $1, updated_at = NOW() WHERE id = $2', ['en_revision', proyectoId]);

        await pool.query('COMMIT');

        res.json({ mensaje: 'Cambios aplicados correctamente', aplicados: cambios.length });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error aplicando cambios:', error);
        res.status(500).json({ error: 'Error al persistir los cambios en la base de datos' });
    }
};
