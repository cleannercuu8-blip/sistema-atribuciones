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
 * Recorre la cadena padre_atribucion_id hacia arriba para encontrar
 * el atribucion_general_id correcto (Ley). Devuelve null si no lo encuentra.
 */
async function resolverAtribucionGeneralDesdeRaiz(atribucionId, limite = 50) {
    let currentId = atribucionId;
    let safety = 0;

    while (currentId && safety < limite) {
        const res = await pool.query(
            'SELECT id, padre_atribucion_id, atribucion_general_id FROM atribuciones_especificas WHERE id = $1',
            [currentId]
        );
        if (res.rows.length === 0) break;
        const row = res.rows[0];
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
        const { cambios, nombreArchivo, usuarioNombre } = req.body;

        if (!cambios || !Array.isArray(cambios)) {
            return res.status(400).json({ error: 'Formato de cambios inválido' });
        }

        await pool.query('BEGIN');

        let aplicados = 0;

        for (const cambio of cambios) {
            const tipo = cambio.tipo || 'atribucion_especifica';

            if (tipo === 'atribucion_especifica') {
                // ── Cambio de texto de atribución específica ──────────────────
                await pool.query(
                    `UPDATE atribuciones_especificas
                     SET texto = $1, updated_at = NOW()
                     WHERE id = $2 AND proyecto_id = $3`,
                    [cambio.texto_propuesto, cambio.id, proyectoId]
                );
                aplicados++;

            } else if (tipo === 'glosario') {
                // ── Cambio de significado en glosario ──────────────────────────
                // IMPORTANTE: la tabla glosario NO tiene updated_at → no lo incluir
                await pool.query(
                    `UPDATE glosario
                     SET significado = $1
                     WHERE id = $2 AND proyecto_id = $3`,
                    [cambio.texto_propuesto, cambio.id, proyectoId]
                );
                aplicados++;

            } else if (tipo === 'atribucion_general') {
                // ── Cambio de texto en atribución general (Ley) ───────────────
                // atribuciones_generales tampoco tiene updated_at en el schema
                await pool.query(
                    `UPDATE atribuciones_generales
                     SET texto = $1
                     WHERE id = $2 AND proyecto_id = $3`,
                    [cambio.texto_propuesto, cambio.id, proyectoId]
                );
                aplicados++;

            } else if (tipo === 'corresponsabilidad') {
                // ── Cambio de corresponsabilidad (padre_atribucion_id) ─────────
                const nuevaClave = cambio.clave_propuesta?.trim() || '';

                let nuevoPadreId = null;
                let nuevaAtribucionGeneralId = null;

                if (nuevaClave !== '') {
                    // 1. Buscar en atribuciones_especificas
                    const padreRes = await pool.query(
                        `SELECT id, atribucion_general_id, padre_atribucion_id
                         FROM atribuciones_especificas
                         WHERE proyecto_id = $1 AND clave = $2 AND activo = true
                         LIMIT 1`,
                        [proyectoId, nuevaClave]
                    );

                    if (padreRes.rows.length > 0) {
                        const padreRow = padreRes.rows[0];
                        nuevoPadreId = padreRow.id;

                        // Resolver la cadena hacia la Ley desde el nuevo padre
                        if (padreRow.atribucion_general_id) {
                            nuevaAtribucionGeneralId = padreRow.atribucion_general_id;
                        } else {
                            nuevaAtribucionGeneralId = await resolverAtribucionGeneralDesdeRaiz(padreRow.padre_atribucion_id);
                        }
                    } else {
                        // 2. Si no está en específicas, buscar en generales (Atribuciones de la Ley)
                        const agRes = await pool.query(
                            `SELECT id FROM atribuciones_generales
                             WHERE proyecto_id = $1 AND clave = $2 AND activo = true
                             LIMIT 1`,
                            [proyectoId, nuevaClave]
                        );

                        if (agRes.rows.length > 0) {
                            nuevaAtribucionGeneralId = agRes.rows[0].id;
                            nuevoPadreId = null; // Cuelga directamente de un bloque de la Ley
                        } else {
                            console.warn(`[corresponsabilidad] Clave "${nuevaClave}" no encontrada en proyecto ${proyectoId}, se omite.`);
                            continue;
                        }
                    }
                }

                // Actualizar: nuevo padre y nueva atribución general (Ley)
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
                        nuevaClave || null,
                        cambio.id,
                        proyectoId
                    ]
                );
                aplicados++;
            }
        }

        // Marcar proyecto como en revisión
        await pool.query(
            'UPDATE proyectos SET estado = $1, updated_at = NOW() WHERE id = $2',
            ['en_revision', proyectoId]
        );

        // ── Guardar en historial ───────────────────────────────────────────
        try {
            await pool.query(
                `INSERT INTO historial_revisiones_excel
                    (proyecto_id, nombre_archivo, total_cambios, cambios_aplicados, usuario_nombre, resumen_cambios)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    proyectoId,
                    nombreArchivo || 'archivo.xlsx',
                    cambios.length,
                    aplicados,
                    usuarioNombre || 'Sistema',
                    JSON.stringify(cambios)
                ]
            );
        } catch (histErr) {
            // El historial es opcional; no abortar si falla (tabla quizá no existe aún)
            console.warn('[historial] No se pudo guardar historial:', histErr.message);
        }

        await pool.query('COMMIT');

        res.json({ mensaje: 'Cambios aplicados correctamente', aplicados });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error aplicando cambios:', error);
        res.status(500).json({ error: 'Error al persistir los cambios en la base de datos' });
    }
};

/**
 * Lista el historial de Excels de revisión subidos para un proyecto,
 * ordenado del más reciente al más antiguo.
 */
exports.listarHistorial = async (req, res) => {
    try {
        const { proyectoId } = req.params;
        const result = await pool.query(
            `SELECT id, nombre_archivo, total_cambios, cambios_aplicados, usuario_nombre, resumen_cambios, created_at
             FROM historial_revisiones_excel
             WHERE proyecto_id = $1
             ORDER BY created_at DESC`,
            [proyectoId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error listando historial:', error);
        res.status(500).json({ error: 'Error al obtener el historial' });
    }
};
