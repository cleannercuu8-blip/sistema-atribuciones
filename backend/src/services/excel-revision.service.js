const exceljs = require('exceljs');
const pool = require('../config/db');
const { exportarExcel } = require('./excel.service');

// Helpers (mismos que excel.service)
const getColumnLetter = (n) => {
    let result = '';
    while (n > 0) {
        const remainder = (n - 1) % 26;
        result = String.fromCharCode(65 + remainder) + result;
        n = Math.floor((n - 1) / 26);
    }
    return result;
};

const obtenerCadena = (unidad, mapaUnidades) => {
    const cadena = [];
    let actual = unidad;
    while (actual) {
        cadena.unshift(actual);
        actual = actual.padre_id ? mapaUnidades[actual.padre_id] : null;
    }
    if (cadena.length === 0 || cadena[0].nivel_numero !== 0) {
        cadena.unshift({ nivel_numero: 0, nombre: 'ORIGEN DE LA ATRIBUCIÓN', siglas: 'LEY' });
    }
    return cadena;
};

// Aplica estilo a celda editable (Observaciones = amarillo, Propuesta = verde)
const estiloEditable = (cell, defaultValue, color) => {
    cell.value = defaultValue || '';
    cell.protection = { locked: false };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.alignment = { vertical: 'top', wrapText: true };
    cell.border = {
        top: { style: 'hair', color: { argb: 'cccccc' } },
        bottom: { style: 'hair', color: { argb: 'cccccc' } },
        left: { style: 'hair', color: { argb: 'cccccc' } },
        right: { style: 'hair', color: { argb: 'cccccc' } },
    };
};

const estiloEncabezadoRev = (cell, texto) => {
    cell.value = texto;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a3a5c' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
        top: { style: 'thin', color: { argb: 'cccccc' } },
        bottom: { style: 'thin', color: { argb: 'cccccc' } },
        left: { style: 'thin', color: { argb: 'cccccc' } },
        right: { style: 'thin', color: { argb: 'cccccc' } },
    };
};

const protegerHoja = async (ws) => {
    await ws.protect('password123', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: true,
        formatColumns: true,
        formatRows: true,
        insertColumns: false,
        insertRows: false,
        deleteColumns: false,
        deleteRows: false,
        sort: true,
        autoFilter: true,
    });
};

class ExcelRevisionService {

    /**
     * Genera el Excel COMPLETO igual que el export general, pero con columnas de revisión
     * añadidas a:
     *  - Cada hoja de unidad: ID (oculto), OBSERVACIONES, NUEVA PROPUESTA, NUEVA CORRESPONSABILIDAD
     *  - Hoja GLOSARIOS: ID (oculto), OBSERVACIONES, NUEVA PROPUESTA
     *  - Hoja ATRIBUCIONES GENERALES: ID (oculto), OBSERVACIONES, NUEVA PROPUESTA
     */
    async generarExcelRevision(proyectoId) {
        // Generar el workbook base (que tiene todas las pestañas)
        const workbook = await exportarExcel(proyectoId);

        // ── Obtener datos para las columnas de revisión ─────────────────
        const unidadesResult = await pool.query(
            `SELECT * FROM unidades_administrativas WHERE proyecto_id = $1 ORDER BY nivel_numero ASC, orden ASC`,
            [proyectoId]
        );
        const unidades = unidadesResult.rows;

        const atEspResult = await pool.query(
            `SELECT ae.id, ae.unidad_id, ae.clave, ae.texto, ae.activo, ae.corresponsabilidad,
                    ae.padre_atribucion_id, ae.atribucion_general_id
             FROM atribuciones_especificas ae
             WHERE ae.proyecto_id = $1 AND ae.activo = true
             ORDER BY ae.unidad_id, ae.clave`,
            [proyectoId]
        );
        const atriEspecificas = atEspResult.rows;

        // Atribuciones agrupadas por unidad
        const atribPorUnidad = {};
        atriEspecificas.forEach(a => {
            if (!atribPorUnidad[a.unidad_id]) atribPorUnidad[a.unidad_id] = [];
            atribPorUnidad[a.unidad_id].push(a);
        });

        // Mapa de unidades para calcular la cadena
        const unidadesMap = {};
        unidades.forEach(u => { unidadesMap[String(u.id)] = u; });

        const atriMap = {};
        atriEspecificas.forEach(a => { atriMap[String(a.id)] = a; });

        // Obtener atribuciones generales (Ley) de forma global
        const agResult = await pool.query(
            'SELECT * FROM atribuciones_generales WHERE proyecto_id = $1 AND activo = true ORDER BY clave',
            [proyectoId]
        );

        // ── Procesar hoja GLOSARIOS ─────────────────────────────────────
        const wsGlos = workbook.getWorksheet('GLOSARIOS');
        if (wsGlos) {
            // Estructura actual: fila 1 = título, fila 2 = encabezados (A=ACRÓNIMO, B=SIGNIFICADO)
            // datos desde fila 3. Añadimos C=ID(oculto), D=OBS, E=NUEVA PROPUESTA
            wsGlos.getColumn(3).width = 5;
            wsGlos.getColumn(3).hidden = true;
            wsGlos.getColumn(4).width = 38;
            wsGlos.getColumn(5).width = 45;

            estiloEncabezadoRev(wsGlos.getCell('C2'), 'ID');
            estiloEncabezadoRev(wsGlos.getCell('D2'), 'OBSERVACIONES DEL REVISOR');
            estiloEncabezadoRev(wsGlos.getCell('E2'), 'NUEVA PROPUESTA');

            // Obtener glosario con IDs
            const glosResult = await pool.query(
                'SELECT * FROM glosario WHERE proyecto_id = $1 ORDER BY acronimo',
                [proyectoId]
            );

            let filaG = 3;
            for (const g of glosResult.rows) {
                // ID (bloqueado)
                const celId = wsGlos.getCell(`C${filaG}`);
                celId.value = g.id;
                celId.protection = { locked: true };

                // Observaciones
                estiloEditable(wsGlos.getCell(`D${filaG}`), '', 'FFFFF2CC');

                // Nueva Propuesta (por defecto = significado actual)
                estiloEditable(wsGlos.getCell(`E${filaG}`), g.significado, 'FFE2EFDA');

                filaG++;
            }

            await protegerHoja(wsGlos);
        }

        // ── Procesar hoja ATRIBUCIONES GENERALES ───────────────────────
        const wsAG = workbook.getWorksheet('ATRIBUCIONES GENERALES');
        if (wsAG) {
            // Estructura actual: fila 1 = título, fila 2 = descripción, fila 3 = encabezados (A-E)
            // datos desde fila 4. Añadimos F=ID(oculto), G=OBS, H=NUEVA PROPUESTA
            wsAG.getColumn(6).width = 5;
            wsAG.getColumn(6).hidden = true;
            wsAG.getColumn(7).width = 38;
            wsAG.getColumn(8).width = 50;

            estiloEncabezadoRev(wsAG.getCell('F3'), 'ID');
            estiloEncabezadoRev(wsAG.getCell('G3'), 'OBSERVACIONES DEL REVISOR');
            estiloEncabezadoRev(wsAG.getCell('H3'), 'NUEVA PROPUESTA (Texto)');

            estiloEncabezadoRev(wsAG.getCell('H3'), 'NUEVA PROPUESTA (Texto)');

            let filaAG = 4;
            for (const ag of agResult.rows) {
                const celId = wsAG.getCell(`F${filaAG}`);
                celId.value = ag.id;
                celId.protection = { locked: true };

                estiloEditable(wsAG.getCell(`G${filaAG}`), '', 'FFFFF2CC');
                estiloEditable(wsAG.getCell(`H${filaAG}`), ag.texto, 'FFE2EFDA');

                filaAG++;
            }

            await protegerHoja(wsAG);
        }

        // ── Recorrer cada hoja de unidad y añadir columnas ─────────────
        for (const unidad of unidades) {
            const wsName = unidad.siglas.substring(0, 31);
            const ws = workbook.getWorksheet(wsName);
            if (!ws) continue;

            const cadena = obtenerCadena(unidad, unidadesMap);
            const numColsExistentes = cadena.length * 2 + 1; // clave+texto por nivel + corresponsabilidad

            const colIdNum = numColsExistentes + 1;
            const colObsNum = numColsExistentes + 2;
            const colPropNum = numColsExistentes + 3;
            const colCorrClaveNum = numColsExistentes + 4; // ← NUEVA: Corresponsabilidad por clave

            const colId = getColumnLetter(colIdNum);
            const colObs = getColumnLetter(colObsNum);
            const colProp = getColumnLetter(colPropNum);
            const colCorrClave = getColumnLetter(colCorrClaveNum);

            // Extender estilos de encabezado
            ['A1', `${colId}1`, `${colObs}1`, `${colProp}1`, `${colCorrClave}1`].forEach(addr => {
                if (ws.getCell(addr).value === null) {
                    ws.getCell(addr).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a3a5c' } };
                }
            });

            // Col ID oculta
            ws.getColumn(colIdNum).width = 5;
            ws.getColumn(colIdNum).hidden = true;
            estiloEncabezadoRev(ws.getCell(`${colId}3`), 'ID');

            // Col Observaciones
            ws.getColumn(colObsNum).width = 38;
            estiloEncabezadoRev(ws.getCell(`${colObs}3`), 'OBSERVACIONES DEL REVISOR');

            // Col Nueva Propuesta de Texto
            ws.getColumn(colPropNum).width = 50;
            estiloEncabezadoRev(ws.getCell(`${colProp}3`), 'NUEVA PROPUESTA (TEXTO)');

            // Col Nueva Corresponsabilidad (clave del padre en unidad superior)
            ws.getColumn(colCorrClaveNum).width = 28;
            estiloEncabezadoRev(ws.getCell(`${colCorrClave}3`), 'NUEVA CORRESP. (CLAVE SUPERIOR)');

            // Obtener claves del nivel superior para el comentario/nota de referencia y lista desplegable
            let clavesSuperioresArray = [];
            if (unidad.padre_id) {
                const padreAtribs = atribPorUnidad[unidad.padre_id] || [];
                clavesSuperioresArray = padreAtribs.map(a => a.clave);
            } else {
                // Si es Nivel 1, su superior directo es la Ley (Atribuciones Generales)
                clavesSuperioresArray = agResult.rows.map(ag => ag.clave);
            }

            // Llenar filas de datos
            const atribsDeEstaUnidad = atribPorUnidad[unidad.id] || [];
            let fila = 4;
            for (const atr of atribsDeEstaUnidad) {
                // ID (bloqueado, oculto)
                const celId = ws.getCell(`${colId}${fila}`);
                celId.value = atr.id;
                celId.protection = { locked: true };

                // Observaciones (editable, amarillo)
                estiloEditable(ws.getCell(`${colObs}${fila}`), '', 'FFFFF2CC');

                // Nueva Propuesta de Texto (editable, verde claro)
                estiloEditable(ws.getCell(`${colProp}${fila}`), atr.texto, 'FFE2EFDA');

                // Nueva Corresponsabilidad por Clave (editable, azul claro)
                // Valor por defecto: clave actual del padre (si existe) o de la Ley (si es Nivel 1)
                let claveActualPadre = '';
                if (atr.padre_atribucion_id && atriMap[String(atr.padre_atribucion_id)]) {
                    claveActualPadre = atriMap[String(atr.padre_atribucion_id)].clave || '';
                } else if (atr.atribucion_general_id) {
                    const agObj = agResult.rows.find(ag => ag.id === atr.atribucion_general_id);
                    if (agObj) claveActualPadre = agObj.clave || '';
                }

                const celCorrClave = ws.getCell(`${colCorrClave}${fila}`);
                celCorrClave.value = claveActualPadre;
                celCorrClave.protection = { locked: false };
                celCorrClave.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // Azul claro
                celCorrClave.alignment = { vertical: 'top', wrapText: false };

                if (clavesSuperioresArray.length > 0) {
                    const listString = `"${clavesSuperioresArray.join(',')}"`;
                    if (listString.length < 255) {
                        celCorrClave.dataValidation = {
                            type: 'list',
                            allowBlank: true,
                            showErrorMessage: true,
                            errorStyle: 'warning',
                            errorTitle: 'Clave recomendada',
                            error: 'La clave ingresada no es común para el nivel superior.',
                            formulae: [listString]
                        };
                    }
                }
                celCorrClave.border = {
                    top: { style: 'hair', color: { argb: 'cccccc' } },
                    bottom: { style: 'hair', color: { argb: 'cccccc' } },
                    left: { style: 'hair', color: { argb: 'cccccc' } },
                    right: { style: 'hair', color: { argb: 'cccccc' } },
                };

                // Añadir nota con las claves disponibles del superior
                if (clavesSuperioresArray.length > 0) {
                    celCorrClave.note = {
                        texts: [{ text: `Claves disponibles del superior:\n${clavesSuperioresArray.join(', ')}` }],
                        editAs: 'oneCells',
                    };
                }

                fila++;
            }

            // Proteger hoja con columnas editables
            await protegerHoja(ws);
        }

        return workbook;
    }

    /**
     * Analiza el Excel de revisión subido.
     * Detecta cambios en:
     * - Hojas de unidad: texto (tipo: 'atribucion_especifica') y corresponsabilidad por clave (tipo: 'corresponsabilidad')
     * - Hoja GLOSARIOS: significado (tipo: 'glosario')
     * - Hoja ATRIBUCIONES GENERALES: texto (tipo: 'atribucion_general')
     */
    async analizarExcel(proyectoId, buffer) {
        const workbook = new exceljs.Workbook();
        await workbook.xlsx.load(buffer);

        const cambios = [];
        const HOJAS_SISTEMA = ['ORGANIGRAMA', 'GLOSARIOS', 'ATRIBUCIONES GENERALES'];

        // Mapa de textos actuales de atribuciones_especificas
        const atriEspMap = new Map();
        const resAE = await pool.query(
            `SELECT ae.id, ae.texto, ae.corresponsabilidad, ae.padre_atribucion_id, ae.atribucion_general_id,
                    pa.clave as padre_clave, ag.clave as ag_clave
             FROM atribuciones_especificas ae
             LEFT JOIN atribuciones_especificas pa ON ae.padre_atribucion_id = pa.id
             LEFT JOIN atribuciones_generales ag ON ae.atribucion_general_id = ag.id
             WHERE ae.proyecto_id = $1 AND ae.activo = true`,
            [proyectoId]
        );
        resAE.rows.forEach(r => atriEspMap.set(r.id.toString(), r));

        // Mapa de glosario actual
        const glosMap = new Map();
        const resGlos = await pool.query(
            'SELECT id, acronimo, significado FROM glosario WHERE proyecto_id = $1',
            [proyectoId]
        );
        resGlos.rows.forEach(r => glosMap.set(r.id.toString(), r));

        // Mapa de atribuciones generales actuales
        const agMap = new Map();
        const resAG = await pool.query(
            'SELECT id, clave, norma, articulo, fraccion_parrafo, texto FROM atribuciones_generales WHERE proyecto_id = $1 AND activo = true',
            [proyectoId]
        );
        resAG.rows.forEach(r => agMap.set(r.id.toString(), r));

        // ── Procesar hoja GLOSARIOS ─────────────────────────────────────
        const wsGlos = workbook.getWorksheet('GLOSARIOS');
        if (wsGlos) {
            // Encabezados en fila 2 (A=ACRÓNIMO, B=SIGNIFICADO, C=ID, D=OBS, E=NUEVA PROPUESTA)
            let colIdG = null, colObsG = null, colPropG = null;
            const headerRowG = wsGlos.getRow(2);
            headerRowG.eachCell((cell, colNum) => {
                const v = cell.value?.toString()?.trim();
                if (v === 'ID') colIdG = colNum;
                else if (v === 'OBSERVACIONES DEL REVISOR') colObsG = colNum;
                else if (v === 'NUEVA PROPUESTA') colPropG = colNum;
            });

            if (colIdG && colPropG) {
                wsGlos.eachRow((row, rowNumber) => {
                    if (rowNumber < 3) return;
                    const idVal = row.getCell(colIdG).value;
                    if (!idVal) return;
                    const idStr = idVal.toString().trim();
                    if (isNaN(parseInt(idStr))) return;

                    const newSignificado = row.getCell(colPropG).value?.toString()?.trim() || '';
                    const obs = colObsG ? (row.getCell(colObsG).value?.toString()?.trim() || '') : '';
                    const original = glosMap.get(idStr);

                    if (original && original.significado.trim() !== newSignificado) {
                        cambios.push({
                            tipo: 'glosario',
                            id: parseInt(idStr),
                            acronimo: original.acronimo,
                            texto_original: original.significado,
                            texto_propuesto: newSignificado,
                            observacion: obs,
                            hoja: 'GLOSARIOS',
                        });
                    }
                });
            }
        }

        // ── Procesar hoja ATRIBUCIONES GENERALES ───────────────────────
        const wsAG = workbook.getWorksheet('ATRIBUCIONES GENERALES');
        if (wsAG) {
            // Encabezados en fila 3 (A-E existentes, F=ID, G=OBS, H=NUEVA PROPUESTA)
            let colIdAG = null, colObsAG = null, colPropAG = null;
            const headerRowAG = wsAG.getRow(3);
            headerRowAG.eachCell((cell, colNum) => {
                const v = cell.value?.toString()?.trim();
                if (v === 'ID') colIdAG = colNum;
                else if (v === 'OBSERVACIONES DEL REVISOR') colObsAG = colNum;
                else if (v === 'NUEVA PROPUESTA (Texto)') colPropAG = colNum;
            });

            if (colIdAG && colPropAG) {
                wsAG.eachRow((row, rowNumber) => {
                    if (rowNumber < 4) return;
                    const idVal = row.getCell(colIdAG).value;
                    if (!idVal) return;
                    const idStr = idVal.toString().trim();
                    if (isNaN(parseInt(idStr))) return;

                    const newTexto = row.getCell(colPropAG).value?.toString()?.trim() || '';
                    const obs = colObsAG ? (row.getCell(colObsAG).value?.toString()?.trim() || '') : '';
                    const original = agMap.get(idStr);

                    if (original && original.texto.trim() !== newTexto) {
                        cambios.push({
                            tipo: 'atribucion_general',
                            id: parseInt(idStr),
                            clave: original.clave,
                            texto_original: original.texto,
                            texto_propuesto: newTexto,
                            observacion: obs,
                            hoja: 'ATRIBUCIONES GENERALES',
                        });
                    }
                });
            }
        }

        // ── Procesar hojas de unidad ────────────────────────────────────
        workbook.eachSheet((sheet) => {
            if (HOJAS_SISTEMA.includes(sheet.name)) return;

            // Detectar columnas por encabezado en fila 3
            let colIdNum = null;
            let colObsNum = null;
            let colPropNum = null;
            let colCorrClaveNum = null;

            const headerRow = sheet.getRow(3);
            headerRow.eachCell((cell, colNumber) => {
                const val = cell.value?.toString()?.trim();
                if (val === 'ID') colIdNum = colNumber;
                else if (val === 'OBSERVACIONES DEL REVISOR') colObsNum = colNumber;
                else if (val === 'NUEVA PROPUESTA (TEXTO)') colPropNum = colNumber;
                else if (val === 'NUEVA CORRESP. (CLAVE SUPERIOR)') colCorrClaveNum = colNumber;
            });

            if (!colIdNum || !colPropNum) return;

            sheet.eachRow((row, rowNumber) => {
                if (rowNumber <= 3) return;

                const idVal = row.getCell(colIdNum).value;
                if (!idVal) return;
                const idStr = idVal.toString().trim();
                if (isNaN(parseInt(idStr))) return;

                const obs = colObsNum ? (row.getCell(colObsNum).value?.toString()?.trim() || '') : '';

                // -- Cambio de TEXTO --
                const newText = row.getCell(colPropNum).value?.toString()?.trim() || '';
                const dbRow = atriEspMap.get(idStr);
                if (dbRow && dbRow.texto.trim() !== newText) {
                    cambios.push({
                        tipo: 'atribucion_especifica',
                        id: parseInt(idStr),
                        texto_original: dbRow.texto,
                        texto_propuesto: newText,
                        observacion: obs,
                        hoja: sheet.name,
                    });
                }

                // -- Cambio de CORRESPONSABILIDAD (clave del padre) --
                if (colCorrClaveNum) {
                    const nuevaClave = row.getCell(colCorrClaveNum).value?.toString()?.trim() || '';
                    const claveActual = dbRow?.padre_clave?.trim() || dbRow?.ag_clave?.trim() || '';

                    if (dbRow && nuevaClave !== claveActual) {
                        cambios.push({
                            tipo: 'corresponsabilidad',
                            id: parseInt(idStr),
                            clave_actual: claveActual,
                            clave_propuesta: nuevaClave,
                            observacion: obs,
                            hoja: sheet.name,
                            // metadatos para mostrar en el fronted
                            texto_original: `Corresponsabilidad: ${claveActual || '(sin asignación)'}`,
                            texto_propuesto: `Corresponsabilidad: ${nuevaClave || '(sin asignación)'}`,
                        });
                    }
                }
            });
        });

        return cambios;
    }
}

module.exports = new ExcelRevisionService();
