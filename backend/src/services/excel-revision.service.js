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

class ExcelRevisionService {

    /**
     * Genera el Excel COMPLETO (mismo que el export general) pero con 3 columnas
     * adicionales al final de cada pestaña de unidad:
     *  - ID_ATRIBUCION (oculta, bloqueada) — para identificar en el análisis
     *  - OBSERVACIONES DEL REVISOR (editable, amarillo)
     *  - NUEVA PROPUESTA DE LA DEPENDENCIA (editable, verde)
     */
    async generarExcelRevision(proyectoId) {
        // Generar el workbook base (que tiene todas las pestañas)
        const workbook = await exportarExcel(proyectoId);

        // ── Obtener datos para añadir columnas de revisión ────────────
        const unidadesResult = await pool.query(
            `SELECT * FROM unidades_administrativas WHERE proyecto_id = $1 ORDER BY nivel_numero ASC, orden ASC`,
            [proyectoId]
        );
        const unidades = unidadesResult.rows;

        const atEspResult = await pool.query(
            `SELECT ae.id, ae.unidad_id, ae.clave, ae.texto, ae.activo
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

        // ── Recorrer cada pestaña de unidad y añadir columnas ─────────
        for (const unidad of unidades) {
            const wsName = unidad.siglas.substring(0, 31);
            const ws = workbook.getWorksheet(wsName);
            if (!ws) continue;

            const cadena = obtenerCadena(unidad, unidadesMap);
            // El número de columnas de datos ya existentes = cadena.length * 2 + 1 (corresponsabilidad)
            const numColsExistentes = cadena.length * 2 + 1;

            // Columnas nuevas
            const colIdNum = numColsExistentes + 1;  // ID (oculta)
            const colObsNum = numColsExistentes + 2;  // Observaciones
            const colPropNum = numColsExistentes + 3;  // Nueva Propuesta

            const colId = getColumnLetter(colIdNum);
            const colObs = getColumnLetter(colObsNum);
            const colProp = getColumnLetter(colPropNum);

            // Extender el merge del título (fila 1) y descripción (fila 2)
            const ultimaColNueva = colProp;
            // Desanclar merges existentes (ExcelJS no permite re-merge, así que actualizamos valor solo)
            try {
                const ultimaColVieja = getColumnLetter(numColsExistentes);
                ws.getRow(1).height = 30;
                // El valor del título ya está en A1; sólo ajustamos el color en las celdas nuevas
                ['A1', `${colId}1`, `${colObs}1`, `${colProp}1`].forEach(addr => {
                    if (ws.getCell(addr).value === null) {
                        ws.getCell(addr).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a3a5c' } };
                    }
                });
            } catch (_) { }

            // Encabezados fila 3
            const estiloEncabezado = (cell, texto) => {
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

            // Col ID oculta
            ws.getColumn(colIdNum).width = 5;
            ws.getColumn(colIdNum).hidden = true;  // Ocultamos la columna ID
            estiloEncabezado(ws.getCell(`${colId}3`), 'ID');

            // Col Observaciones
            ws.getColumn(colObsNum).width = 38;
            estiloEncabezado(ws.getCell(`${colObs}3`), 'OBSERVACIONES DEL REVISOR');

            // Col Nueva Propuesta
            ws.getColumn(colPropNum).width = 50;
            estiloEncabezado(ws.getCell(`${colProp}3`), 'NUEVA PROPUESTA DE LA DEPENDENCIA');

            // ── Proteger hoja con nuevas columnas editables ───────────
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

            // ── Llenar ID, Observaciones, Nueva Propuesta por fila ────
            const atribsDeEstaUnidad = atribPorUnidad[unidad.id] || [];
            let fila = 4;  // La fila 4 en adelante son datos (igual que en excel.service)
            for (const atr of atribsDeEstaUnidad) {
                // ID (bloqueado, oculto)
                const celId = ws.getCell(`${colId}${fila}`);
                celId.value = atr.id;
                celId.protection = { locked: true };

                // Observaciones (editable, amarillo)
                const celObs = ws.getCell(`${colObs}${fila}`);
                celObs.value = '';
                celObs.protection = { locked: false };
                celObs.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
                celObs.alignment = { vertical: 'top', wrapText: true };
                celObs.border = {
                    top: { style: 'hair', color: { argb: 'cccccc' } },
                    bottom: { style: 'hair', color: { argb: 'cccccc' } },
                    left: { style: 'hair', color: { argb: 'cccccc' } },
                    right: { style: 'hair', color: { argb: 'cccccc' } },
                };

                // Nueva Propuesta (editable, verde claro)
                const celProp = ws.getCell(`${colProp}${fila}`);
                celProp.value = atr.texto;  // valor por defecto = texto actual
                celProp.protection = { locked: false };
                celProp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
                celProp.alignment = { vertical: 'top', wrapText: true };
                celProp.border = {
                    top: { style: 'hair', color: { argb: 'cccccc' } },
                    bottom: { style: 'hair', color: { argb: 'cccccc' } },
                    left: { style: 'hair', color: { argb: 'cccccc' } },
                    right: { style: 'hair', color: { argb: 'cccccc' } },
                };

                fila++;
            }
        }

        return workbook;
    }

    /**
     * Analiza el Excel de revisión subido.
     * Recorre TODAS las pestañas (que no sean ORGANIGRAMA, GLOSARIOS ni ATRIBUCIONES GENERALES).
     * En cada pestaña busca filas con dato en la columna ID y detecta si "Nueva Propuesta" difiere.
     */
    async analizarExcel(proyectoId, buffer) {
        const workbook = new exceljs.Workbook();
        await workbook.xlsx.load(buffer);

        const cambios = [];
        const HOJAS_SISTEMA = ['ORGANIGRAMA', 'GLOSARIOS', 'ATRIBUCIONES GENERALES'];

        // Mapa de textos actuales en BD
        const originalDataMap = new Map();
        const result = await pool.query(
            'SELECT id, texto FROM atribuciones_especificas WHERE proyecto_id = $1',
            [proyectoId]
        );
        result.rows.forEach(r => originalDataMap.set(r.id.toString(), r.texto));

        // Procesar cada hoja de unidad
        workbook.eachSheet((sheet) => {
            if (HOJAS_SISTEMA.includes(sheet.name)) return;

            // Detectar el número de columna del ID dinámicamente:
            // La fila 3 tiene los encabezados. Buscamos la celda cuyo valor sea 'ID'
            let colIdNum = null;
            let colObsNum = null;
            let colPropNum = null;

            const headerRow = sheet.getRow(3);
            headerRow.eachCell((cell, colNumber) => {
                const val = cell.value?.toString()?.trim();
                if (val === 'ID') colIdNum = colNumber;
                else if (val === 'OBSERVACIONES DEL REVISOR') colObsNum = colNumber;
                else if (val === 'NUEVA PROPUESTA DE LA DEPENDENCIA') colPropNum = colNumber;
            });

            if (!colIdNum || !colPropNum) return; // hoja sin columnas de revisión

            sheet.eachRow((row, rowNumber) => {
                if (rowNumber <= 3) return; // saltar título, descripción y encabezados

                const idVal = row.getCell(colIdNum).value;
                const newText = row.getCell(colPropNum).value?.toString()?.trim() || '';
                const obs = colObsNum ? (row.getCell(colObsNum).value?.toString()?.trim() || '') : '';

                if (!idVal) return;
                const idStr = idVal.toString().trim();
                if (isNaN(parseInt(idStr))) return;

                const dbText = originalDataMap.get(idStr);
                if (dbText !== undefined && dbText.trim() !== newText) {
                    cambios.push({
                        id: parseInt(idStr),
                        texto_original: dbText,
                        texto_propuesto: newText,
                        observacion: obs,
                        hoja: sheet.name,
                    });
                }
            });
        });

        return cambios;
    }
}

module.exports = new ExcelRevisionService();
