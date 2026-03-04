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

/**
 * Resuelve la cadena de atribucion_general_id subiendo por padre_atribucion_id
 * hasta encontrar el primero que tenga atribucion_general_id definido.
 * Devuelve el id de la atribución general (Ley), o null si no se encuentra.
 */
async function resolverAtribucionGeneralDesdeRaiz(atribucionId, limite = 50) {
    let ids = [];
    let currentId = atribucionId;
    let safety = 0;

    while (currentId && safety < limite) {
        const res = await pool.query(
            'SELECT id, padre_atribucion_id, atribucion_general_id FROM atribuciones_especificas WHERE id = $1',
            [currentId]
        );
        if (res.rows.length === 0) break;
        const row = res.rows[0];
        ids.push(row);
        if (row.atribucion_general_id) {
            return row.atribucion_general_id;
        }
        currentId = row.padre_atribucion_id;
        safety++;
    }
    return null;
}

exports.aplicarCambios = async (req, res) => {
    try {
        const { proyectoId } = req.params;
        const { cambios } = req.body;

        if (!cambios || !Array.isArray(cambios)) {
            return res.status(400).json({ error: 'Formato de cambios inválido' });
        }

        await pool.query('BEGIN');

        for (const cambio of cambios) {
            const tipo = cambio.tipo || 'atribucion_especifica';

            if (tipo === 'atribucion_especifica') {
                // ── Cambio de texto de atribución específica ─────────────
                await pool.query(
                    `UPDATE atribuciones_especificas
                     SET texto = $1, updated_at = NOW()
                     WHERE id = $2 AND proyecto_id = $3`,
                    [cambio.texto_propuesto, cambio.id, proyectoId]
                );

            } else if (tipo === 'glosario') {
                // ── Cambio de significado en glosario ─────────────────────
                await pool.query(
                    `UPDATE glosario
                     SET significado = $1, updated_at = NOW()
                     WHERE id = $2 AND proyecto_id = $3`,
                    [cambio.texto_propuesto, cambio.id, proyectoId]
                );

            } else if (tipo === 'atribucion_general') {
                // ── Cambio de texto en atribución general (Ley) ───────────
                await pool.query(
                    `UPDATE atribuciones_generales
                     SET texto = $1, updated_at = NOW()
                     WHERE id = $2 AND proyecto_id = $3`,
                    [cambio.texto_propuesto, cambio.id, proyectoId]
                );

            } else if (tipo === 'corresponsabilidad') {
                // ── Cambio de corresponsabilidad (padre_atribucion_id) ─────
                // La clave propuesta puede venir vacía (quitar corresponsabilidad)
                const nuevaClave = cambio.clave_propuesta?.trim() || '';

                let nuevoPadreId = null;
                let nuevaAtribucionGeneralId = null;

                if (nuevaClave !== '') {
                    // Buscar la atribución que tiene esa clave en el mismo proyecto
                    const padreRes = await pool.query(
                        `SELECT id, atribucion_general_id, padre_atribucion_id
                         FROM atribuciones_especificas
                         WHERE proyecto_id = $1 AND clave = $2 AND activo = true
                         LIMIT 1`,
                        [proyectoId, nuevaClave]
                    );

                    if (padreRes.rows.length === 0) {
                        // Clave no encontrada — ignorar este cambio con advertencia
                        console.warn(`[corresponsabilidad] Clave "${nuevaClave}" no encontrada en proyecto ${proyectoId}, se omite.`);
                        continue;
                    }

                    const padreRow = padreRes.rows[0];
                    nuevoPadreId = padreRow.id;

                    // Subir la cadena desde el padre nuevo para encontrar la Atribución General (Ley)
                    // Primero verificar si el padre directo tiene atribucion_general_id
                    if (padreRow.atribucion_general_id) {
                        nuevaAtribucionGeneralId = padreRow.atribucion_general_id;
                    } else {
                        // Subir la cadena del padre hasta encontrarlo
                        nuevaAtribucionGeneralId = await resolverAtribucionGeneralDesdeRaiz(padreRow.padre_atribucion_id);
                    }
                }

                // Actualizar la atribución: nuevo padre y nueva atribución general (Ley)
                await pool.query(
                    `UPDATE atribuciones_especificas
                     SET padre_atribucion_id = $1,
                         atribucion_general_id = $2,
                         corresponsabilidad = $3,
                         updated_at = NOW()
                     WHERE id = $4 AND proyecto_id = $5`,
                    [
                        nuevoPadreId,
                        nuevaAtribucionGeneralId,
                        nuevaClave || null, // También actualizar el texto libre de corresponsabilidad
                        cambio.id,
                        proyectoId
                    ]
                );
            }
        }

        // Marcar proyecto como en revisión
        await pool.query(
            'UPDATE proyectos SET estado = $1, updated_at = NOW() WHERE id = $2',
            ['en_revision', proyectoId]
        );

        await pool.query('COMMIT');

        res.json({ mensaje: 'Cambios aplicados correctamente', aplicados: cambios.length });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error aplicando cambios:', error);
        res.status(500).json({ error: 'Error al persistir los cambios en la base de datos' });
    }
};
