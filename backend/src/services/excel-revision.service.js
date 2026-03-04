const exceljs = require('exceljs');
const pool = require('../config/db');

class ExcelRevisionService {

    async generarExcelRevision(proyectoId) {
        const workbook = new exceljs.Workbook();
        const sheet = workbook.addWorksheet('Revisión');

        // ── Columnas ──────────────────────────────────────────────────
        sheet.columns = [
            { header: 'ID (NO TOCAR)', key: 'id', width: 12 },
            { header: 'Unidad Administrativa', key: 'unidad', width: 32 },
            { header: 'Nivel', key: 'nivel', width: 8 },
            { header: 'Unidad Superior', key: 'unidad_superior', width: 28 },
            { header: 'Clave', key: 'clave', width: 12 },
            { header: 'Texto Original (Base de Datos)', key: 'texto_original', width: 55 },
            { header: 'Ley / Norma Vinculada', key: 'ley_norma', width: 30 },
            { header: 'Vínculo Superior (Padre)', key: 'padre_clave', width: 22 },
            { header: 'Corresponsabilidad', key: 'corresponsabilidad', width: 28 },
            { header: 'Observaciones del Revisor', key: 'observaciones', width: 38 },
            { header: 'NUEVA PROPUESTA DE LA DEPENDENCIA', key: 'nueva_propuesta', width: 55 },
        ];

        // ── Estilo cabecera principal ─────────────────────────────────
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        headerRow.height = 36;

        // ── Paleta de colores por nivel (fondos de filas de unidad) ───
        const nivelFondos = [
            'FFD6E4F0',  // nivel 1 – azul claro
            'FFCCE5CC',  // nivel 2 – verde claro
            'FFFFF0CC',  // nivel 3 – amarillo claro
            'FFEDD9D9',  // nivel 4 – rosa claro
            'FFE8E0F0',  // nivel 5 – lila claro
            'FFD9EFF7',  // nivel 6+ – cyan claro
        ];

        // ── Consulta: unidades con su superior ────────────────────────
        const unidadesRes = await pool.query(`
            SELECT u.id, u.nombre, u.siglas, u.nivel_numero, p.nombre AS padre_nombre, p.siglas AS padre_siglas
            FROM unidades_administrativas u
            LEFT JOIN unidades_administrativas p ON u.padre_id = p.id
            WHERE u.proyecto_id = $1
            ORDER BY u.nivel_numero, u.nombre
        `, [proyectoId]);

        // ── Consulta: atribuciones con relaciones ─────────────────────
        const atribRes = await pool.query(`
            SELECT
                a.id,
                a.unidad_id,
                a.clave,
                a.texto,
                a.corresponsabilidad,
                padre_a.clave   AS padre_clave,
                ag.clave        AS gen_clave,
                ag.norma        AS gen_norma,
                ag.articulo     AS gen_articulo
            FROM atribuciones_especificas a
            LEFT JOIN atribuciones_especificas padre_a ON a.padre_atribucion_id = padre_a.id
            LEFT JOIN atribuciones_generales   ag      ON a.atribucion_general_id = ag.id
            WHERE a.proyecto_id = $1
            ORDER BY a.unidad_id, a.clave
        `, [proyectoId]);

        // Agrupar atribuciones por unidad
        const atribPorUnidad = {};
        atribRes.rows.forEach(a => {
            if (!atribPorUnidad[a.unidad_id]) atribPorUnidad[a.unidad_id] = [];
            atribPorUnidad[a.unidad_id].push(a);
        });

        // ── Protección de hoja ────────────────────────────────────────
        await sheet.protect('password123', {
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

        // ── Volcado de datos ──────────────────────────────────────────
        unidadesRes.rows.forEach(u => {
            const fondoNivel = nivelFondos[Math.min(u.nivel_numero - 1, nivelFondos.length - 1)];
            const indent = '  '.repeat(u.nivel_numero - 1);

            // Fila cabecera de unidad (sin ID de atribución, no editable)
            const unitRow = sheet.addRow({
                id: '',
                unidad: `${indent}${u.nivel_numero}. ${u.nombre} [${u.siglas}]`,
                nivel: u.nivel_numero,
                unidad_superior: u.padre_nombre ? `${u.padre_nombre} [${u.padre_siglas}]` : '(Raíz)',
                clave: '',
                texto_original: '',
                ley_norma: '',
                padre_clave: '',
                corresponsabilidad: '',
                observaciones: '',
                nueva_propuesta: '',
            });

            // Estilo fila de unidad
            unitRow.font = { bold: true, size: 10, color: { argb: 'FF1F4E78' } };
            unitRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fondoNivel } };
            unitRow.alignment = { vertical: 'middle', wrapText: true };
            unitRow.height = 22;
            // Toda la fila bloqueada
            for (let col = 1; col <= 11; col++) {
                unitRow.getCell(col).protection = { locked: true };
            }

            // Atribuciones de esta unidad
            const atribs = atribPorUnidad[u.id] || [];
            atribs.forEach(a => {
                const leyTexto = [a.gen_clave, a.gen_norma, a.gen_articulo].filter(Boolean).join(' — ');
                const addedRow = sheet.addRow({
                    id: a.id,
                    unidad: `${indent}  ${u.siglas}`,
                    nivel: u.nivel_numero,
                    unidad_superior: u.padre_siglas || '(Raíz)',
                    clave: a.clave,
                    texto_original: a.texto,
                    ley_norma: leyTexto || '',
                    padre_clave: a.padre_clave || '',
                    corresponsabilidad: a.corresponsabilidad || '',
                    observaciones: '',
                    nueva_propuesta: a.texto,  // por defecto igual al original
                });

                addedRow.alignment = { vertical: 'top', wrapText: true };
                addedRow.height = 30;

                // Columnas bloqueadas (A–I)
                for (let col = 1; col <= 9; col++) {
                    addedRow.getCell(col).protection = { locked: true };
                    addedRow.getCell(col).fill = {
                        type: 'pattern', pattern: 'solid',
                        fgColor: { argb: 'FFF8FAFC' }
                    };
                }

                // Col J — Observaciones (editable, amarillo)
                const celObs = addedRow.getCell('observaciones');
                celObs.protection = { locked: false };
                celObs.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

                // Col K — Nueva Propuesta (editable, verde)
                const celProp = addedRow.getCell('nueva_propuesta');
                celProp.protection = { locked: false };
                celProp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
            });

            // Si no hay atribuciones, fila vacía de aviso
            if (atribs.length === 0) {
                const emptyRow = sheet.addRow({
                    id: '', unidad: `${indent}  (Sin atribuciones registradas)`,
                    nivel: '', unidad_superior: '', clave: '', texto_original: '',
                    ley_norma: '', padre_clave: '', corresponsabilidad: '',
                    observaciones: '', nueva_propuesta: '',
                });
                emptyRow.font = { italic: true, color: { argb: 'FF94A3B8' }, size: 9 };
                emptyRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                for (let col = 1; col <= 11; col++) {
                    emptyRow.getCell(col).protection = { locked: true };
                }
            }
        });

        return workbook;
    }

    // ── Analizar Excel subido ──────────────────────────────────────────
    async analizarExcel(proyectoId, buffer) {
        const workbook = new exceljs.Workbook();
        await workbook.xlsx.load(buffer);
        const sheet = workbook.getWorksheet(1);
        const cambios = [];

        // Mapa de textos originales en BD
        const originalDataMap = new Map();
        const result = await pool.query(
            'SELECT id, texto FROM atribuciones_especificas WHERE proyecto_id = $1',
            [proyectoId]
        );
        result.rows.forEach(r => originalDataMap.set(r.id.toString(), r.texto));

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // skip header

            // Col A = ID, F = texto original, J = observaciones, K = nueva propuesta
            const id = row.getCell(1).value?.toString()?.trim();
            const newText = row.getCell(11).value?.toString()?.trim() || '';
            const obs = row.getCell(10).value?.toString()?.trim() || '';

            if (!id || isNaN(parseInt(id))) return; // fila de unidad sin ID

            const dbText = originalDataMap.get(id);
            if (dbText !== undefined && dbText.trim() !== newText) {
                cambios.push({
                    id: parseInt(id),
                    texto_original: dbText,
                    texto_propuesto: newText,
                    observacion: obs,
                });
            }
        });

        return cambios;
    }
}

module.exports = new ExcelRevisionService();
