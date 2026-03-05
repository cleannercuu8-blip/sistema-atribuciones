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
        const path = require('path');
        const buffer = fs.readFileSync(file.path);

        const cambios = await excelRevService.analizarExcel(proyectoId, buffer);

        // En lugar de borrarlo inmediatamente, lo movemos a una carpeta permanente de Revisiones
        // para que quede como historial descargable.
        const ext = path.extname(file.originalname);
        const nuevoNombre = `REV-P${proyectoId}-${Date.now()}${ext}`;
        const destino = path.join(__dirname, '../../uploads/revisiones', nuevoNombre);

        fs.renameSync(file.path, destino);

        res.json({ cambios, archivoUrl: nuevoNombre });
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
    const client = await pool.connect();
    try {
        const { proyectoId } = req.params;
        const { cambios, nombreArchivo, usuarioNombre, archivoUrl } = req.body;

        if (!cambios || !Array.isArray(cambios)) {
            return res.status(400).json({ error: 'Formato de cambios inválido' });
        }

        await client.query('BEGIN');

        let aplicados = 0;

        for (const cambio of cambios) {
            const tipo = cambio.tipo || 'atribucion_especifica';
            let mensajeActividad = '';

            if (tipo === 'atribucion_especifica') {
                const updateRes = await client.query(
                    `UPDATE atribuciones_especificas
                     SET texto = $1, updated_at = NOW()
                     WHERE id = $2 AND proyecto_id = $3`,
                    [cambio.texto_propuesto, cambio.id, proyectoId]
                );
                if (updateRes.rowCount > 0) {
                    mensajeActividad = `Actualizó texto de atribución ID ${cambio.id} vía Excel`;
                    aplicados++;
                }

            } else if (tipo === 'glosario') {
                const updateRes = await client.query(
                    `UPDATE glosario
                     SET significado = $1
                     WHERE id = $2 AND proyecto_id = $3`,
                    [cambio.texto_propuesto, cambio.id, proyectoId]
                );
                if (updateRes.rowCount > 0) {
                    mensajeActividad = `Actualizó glosario ID ${cambio.id} (${cambio.acronimo || ''}) vía Excel`;
                    aplicados++;
                }

            } else if (tipo === 'atribucion_general') {
                const updateRes = await client.query(
                    `UPDATE atribuciones_generales
                     SET texto = $1
                     WHERE id = $2 AND proyecto_id = $3`,
                    [cambio.texto_propuesto, cambio.id, proyectoId]
                );
                if (updateRes.rowCount > 0) {
                    mensajeActividad = `Actualizó atribución de Ley ID ${cambio.id} (${cambio.clave || ''}) vía Excel`;
                    aplicados++;
                }

            } else if (tipo === 'corresponsabilidad') {
                const nuevaClave = cambio.clave_propuesta?.trim() || '';
                let nuevoPadreId = null;
                let nuevaAtribucionGeneralId = null;

                if (nuevaClave !== '') {
                    // Buscar en atribuciones específicas
                    const padreRes = await client.query(
                        `SELECT id, atribucion_general_id, padre_atribucion_id
                         FROM atribuciones_especificas
                         WHERE proyecto_id = $1 AND clave = $2 AND activo = true
                         LIMIT 1`,
                        [proyectoId, nuevaClave]
                    );

                    if (padreRes.rows.length > 0) {
                        const padreRow = padreRes.rows[0];
                        nuevoPadreId = padreRow.id;
                        if (padreRow.atribucion_general_id) {
                            nuevaAtribucionGeneralId = padreRow.atribucion_general_id;
                        } else {
                            // Resolver raíz si no tiene atribucion_general_id directa
                            nuevaAtribucionGeneralId = await resolverAtribucionGeneralDesdeRaiz(nuevoPadreId);
                        }
                    } else {
                        // Buscar en atribuciones generales (Ley)
                        const agRes = await client.query(
                            `SELECT id FROM atribuciones_generales
                             WHERE proyecto_id = $1 AND clave = $2 AND activo = true
                             LIMIT 1`,
                            [proyectoId, nuevaClave]
                        );
                        if (agRes.rows.length > 0) {
                            nuevaAtribucionGeneralId = agRes.rows[0].id;
                        } else {
                            console.warn(`[Excel] No se encontró clave ${nuevaClave} para corresponsabilidad`);
                            continue; // O podríamos manejarlo como error
                        }
                    }
                }

                const updateRes = await client.query(
                    `UPDATE atribuciones_especificas
                     SET padre_atribucion_id = $1,
                         atribucion_general_id = $2,
                         corresponsabilidad = $3,
                         updated_at = NOW()
                     WHERE id = $4 AND proyecto_id = $5`,
                    [nuevoPadreId, nuevaAtribucionGeneralId, nuevaClave || null, cambio.id, proyectoId]
                );

                if (updateRes.rowCount > 0) {
                    mensajeActividad = `Cambió corresponsabilidad de atribución ID ${cambio.id} a "${nuevaClave || 'NINGUNA'}"`;
                    aplicados++;
                }
            }

            // Registrar en tabla de actividades (Movimientos del proyecto)
            if (mensajeActividad) {
                await client.query(
                    `INSERT INTO actividades (tipo, entidad, entidad_id, proyecto_id, mensaje, autor)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    ['actualizacion', 'atribucion_especifica', cambio.id, proyectoId, mensajeActividad, usuarioNombre || 'Sistema']
                );
            }
        }

        await client.query(
            'UPDATE proyectos SET estado = $1, updated_at = NOW() WHERE id = $2',
            ['en_revision', proyectoId]
        );

        // Guardar en historial de revisiones excel
        try {
            await client.query(
                `INSERT INTO historial_revisiones_excel
                    (proyecto_id, nombre_archivo, total_cambios, cambios_aplicados, usuario_nombre, resumen_cambios, archivo_url)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [proyectoId, nombreArchivo || 'archivo.xlsx', cambios.length, aplicados, usuarioNombre || 'Sistema', JSON.stringify(cambios), archivoUrl || null]
            );
        } catch (histErr) {
            console.warn('[historial] No se pudo guardar historial:', histErr.message);
        }

        await client.query('COMMIT');
        res.json({ mensaje: 'Cambios aplicados correctamente', aplicados });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error aplicando cambios:', error);
        res.status(500).json({ error: 'Error al persistir los cambios en la base de datos' });
    } finally {
        client.release();
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
            `SELECT id, nombre_archivo, total_cambios, cambios_aplicados, usuario_nombre, resumen_cambios, created_at, archivo_url
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
