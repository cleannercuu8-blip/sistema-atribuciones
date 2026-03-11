const excelRevService = require('../services/excel-revision.service');
const pool = require('../config/db');

exports.exportarExcel = async (req, res) => {
    try {
        const { proyectoId } = req.params;
        const rol = req.user?.rol;
        let incluirPropuestas = false; // Por defecto responsable/apoyo/admin (solo obs)
        let obsMap = {};

        if (rol === 'enlace') {
            incluirPropuestas = true;
            // Para el enlace, recuperar el dictamen/observaciones del revisor
            // desde el último registro del historial.
            const histRes = await pool.query(
                `SELECT resumen_cambios FROM historial_revisiones_excel 
                 WHERE proyecto_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [proyectoId]
            );
            if (histRes.rows.length > 0 && histRes.rows[0].resumen_cambios) {
                const cambios = typeof histRes.rows[0].resumen_cambios === 'string' 
                    ? JSON.parse(histRes.rows[0].resumen_cambios) 
                    : histRes.rows[0].resumen_cambios;
                    
                obsMap = { glosario: {}, atribucion_general: {}, atribucion_especifica: {} };
                cambios.forEach(c => {
                    const tipo = c.tipo || 'atribucion_especifica';
                    if (c.observacion && obsMap[tipo]) {
                        obsMap[tipo][c.id] = c.observacion;
                    }
                });
            }
        }

        const workbook = await excelRevService.generarExcelRevision(proyectoId, incluirPropuestas, obsMap);

        const proyResult = await pool.query('SELECT nombre FROM proyectos WHERE id = $1', [proyectoId]);
        const nombre = proyResult.rows[0]?.nombre || 'proyecto';
        const tipoArchivo = incluirPropuestas ? 'PARA-SUBSANAR' : 'REVISION';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${tipoArchivo}-${nombre.replace(/\s/g, '-')}.xlsx"`);

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
        const rol = req.user?.rol;

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

        let guardadoEnHistorial = false;
        let mensajeExito = null;

        // Si es enlace, auto-guardamos directamente en el historial porque no tienen botón "Aplicar"
        if (rol === 'enlace') {
            const usuarioId = req.user?.id || null;
            const usuarioNombre = req.user?.nombre || req.user?.username || 'Enlace';
            const resumenJson = JSON.stringify(cambios);
            
            await pool.query(
                `INSERT INTO historial_revisiones_excel 
                 (proyecto_id, nombre_archivo, archivo_url, usuario_id, usuario_nombre, resumen_cambios, total_cambios, cambios_aplicados)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [proyectoId, file.originalname, nuevoNombre, usuarioId, usuarioNombre, resumenJson, cambios.length, 0]
            );

            // Registrar en actividades
            await pool.query(
                `INSERT INTO actividades (tipo, entidad_tipo, entidad_id, proyecto_id, mensaje, usuario_nombre)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                ['actualizacion', 'revision_excel', proyectoId, proyectoId, `Enlace subió Excel de subsanación: ${file.originalname}`, usuarioNombre]
            );

            guardadoEnHistorial = true;
            mensajeExito = '✅ El archivo ha sido enviado correctamente a su Responsable. Lo podrá revisar en el Historial.';
        } else {
            // Si es Responsable/Admin y sube un archivo, vamos a ver si tiene cambios de texto o solo obs.
            // Si el usuario solo quiere subir observaciones, lo guardamos directo para evitar que 
            // le aparezca el verificador de cambios como si él tuviera que subsanar.
            const tienePropuestasDeTexto = cambios.some(c => 
                (c.texto_propuesto && c.texto_propuesto !== c.texto_original) || 
                (c.clave_propuesta && c.clave_propuesta !== c.clave_actual)
            );

            if (!tienePropuestasDeTexto) {
                const usuarioId = req.user?.id || null;
                const usuarioNombre = req.user?.nombre || req.user?.username || 'Responsable';
                const resumenJson = JSON.stringify(cambios);
                
                await pool.query(
                    `INSERT INTO historial_revisiones_excel 
                     (proyecto_id, nombre_archivo, archivo_url, usuario_id, usuario_nombre, resumen_cambios, total_cambios, cambios_aplicados)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [proyectoId, file.originalname, nuevoNombre, usuarioId, usuarioNombre, resumenJson, cambios.length, 0]
                );

                await pool.query(
                    `INSERT INTO actividades (tipo, entidad_tipo, entidad_id, proyecto_id, mensaje, usuario_nombre)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    ['actualizacion', 'revision_excel', proyectoId, proyectoId, `Responsable subió observaciones: ${file.originalname}`, usuarioNombre]
                );

                guardadoEnHistorial = true;
                mensajeExito = '✅ Observaciones guardadas y enviadas al historial. El enlace ya puede descargar este archivo.';
            }
        }

        res.json({ cambios, archivoUrl: nuevoNombre, guardadoEnHistorial, mensajeExito });
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

exports.eliminarHistorial = async (req, res) => {
    const client = await pool.connect();
    try {
        const { proyectoId, id } = req.params;
        const usuarioNombre = req.user?.nombre || 'Usuario';

        await client.query('BEGIN');

        // 1. Obtener info para el log
        const infoRes = await client.query(
            'SELECT nombre_archivo, created_at FROM historial_revisiones_excel WHERE id = $1 AND proyecto_id = $2',
            [id, proyectoId]
        );

        if (infoRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        const info = infoRes.rows[0];
        const fechaStr = new Date(info.created_at).toLocaleString();

        // 2. Eliminar registro
        await client.query(
            'DELETE FROM historial_revisiones_excel WHERE id = $1 AND proyecto_id = $2',
            [id, proyectoId]
        );

        // 3. Registrar actividad
        await client.query(
            `INSERT INTO actividades (tipo, entidad, entidad_id, proyecto_id, mensaje, autor)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                'eliminacion',
                'historial_excel',
                id,
                proyectoId,
                `Eliminó registro de historial Excel: "${info.nombre_archivo}" del ${fechaStr}`,
                usuarioNombre
            ]
        );

        await client.query('COMMIT');
        res.json({ mensaje: 'Registro de historial eliminado correctamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error eliminando historial:', error);
        res.status(500).json({ error: 'Error al eliminar el registro del historial' });
    } finally {
        client.release();
    }
};

exports.actualizarHistorial = async (req, res) => {
    try {
        const { proyectoId, id } = req.params;
        const { nombre_archivo } = req.body;
        const usuarioNombre = req.user?.nombre || 'Usuario';

        if (!nombre_archivo) return res.status(400).json({ error: 'Nombre de archivo requerido' });

        const prevRes = await pool.query(
            'SELECT nombre_archivo FROM historial_revisiones_excel WHERE id = $1 AND proyecto_id = $2',
            [id, proyectoId]
        );

        if (prevRes.rowCount === 0) return res.status(404).json({ error: 'Registro no encontrado' });

        const nombreAnterior = prevRes.rows[0].nombre_archivo;

        await pool.query(
            'UPDATE historial_revisiones_excel SET nombre_archivo = $1 WHERE id = $2 AND proyecto_id = $3',
            [nombre_archivo, id, proyectoId]
        );

        // Registrar actividad
        await pool.query(
            `INSERT INTO actividades (tipo, entidad, entidad_id, proyecto_id, mensaje, autor)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                'actualizacion',
                'historial_excel',
                id,
                proyectoId,
                `Renombró Versión Excel de "${nombreAnterior}" a "${nombre_archivo}"`,
                usuarioNombre
            ]
        );

        res.json({ mensaje: 'Registro actualizado correctamente' });
    } catch (error) {
        console.error('Error actualizando historial:', error);
        res.status(500).json({ error: 'Error al actualizar el registro del historial' });
    }
};

exports.descargarArchivo = async (req, res) => {
    try {
        const { archivoUrl } = req.params;
        const path = require('path');
        const fs = require('fs');
        
        // sanitizar para evitar directory traversal
        const nombreSeguro = path.basename(archivoUrl);
        const fileRuta = path.join(__dirname, '../../uploads/revisiones', nombreSeguro);

        if (!fs.existsSync(fileRuta)) {
            return res.status(404).json({ error: 'El archivo Excel no fue encontrado en el servidor (posiblemente borrado por limpieza del proveedor)' });
        }

        res.download(fileRuta, nombreSeguro);
    } catch (error) {
        console.error('Error enviando archivo excel:', error);
        res.status(500).json({ error: 'Error interno al intentar enviar el archivo' });
    }
};
