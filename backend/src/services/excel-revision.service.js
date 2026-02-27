const exceljs = require('exceljs');
const pool = require('../config/db');

class ExcelRevisionService {
    async generarExcelRevision(proyectoId) {
        const workbook = new exceljs.Workbook();
        const sheet = workbook.addWorksheet('Revisión');

        // Columnas
        sheet.columns = [
            { header: 'ID (NO TOCAR)', key: 'id', width: 10 },
            { header: 'Unidad', key: 'unidad', width: 25 },
            { header: 'Clave', key: 'clave', width: 10 },
            { header: 'Texto Original (Base de Datos)', key: 'texto_original', width: 50 },
            { header: 'Observaciones del Revisor', key: 'observaciones', width: 30 },
            { header: 'NUEVA PROPUESTA DE LA DEPENDENCIA', key: 'nueva_propuesta', width: 50 }
        ];

        // Estilos de Cabecera
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Proteger hoja
        await sheet.protect('password123', {
            selectLockedCells: true,
            selectUnlockedCells: true,
            formatCells: true,
            formatColumns: true,
            formatRows: true,
            insertColumns: false,
            insertRows: false,
            insertHyperlinks: true,
            deleteColumns: false,
            deleteRows: false,
            sort: true,
            autoFilter: true,
            pivotTables: false
        });

        // Obtener datos
        const result = await pool.query(`
            <query>
            SELECT a.id, a.clave, a.texto, u.nombre as unidad_nombre 
            FROM atribuciones_especificas a
            JOIN unidades_administrativas u ON a.unidad_id = u.id
            WHERE a.proyecto_id = $1
            ORDER BY u.nivel_numero, u.nombre, a.clave
            </query>
        `.replace(/<query>|<\/query>/g, ''), [proyectoId]);

        result.rows.forEach(row => {
            const addedRow = sheet.addRow({
                id: row.id,
                unidad: row.unidad_nombre,
                clave: row.clave,
                texto_original: row.texto,
                observaciones: '',
                nueva_propuesta: row.texto // Por defecto es el mismo texto
            });

            // Bloquear celdas, destrabar nueva_propuesta y observaciones
            addedRow.getCell('id').protection = { locked: true };
            addedRow.getCell('unidad').protection = { locked: true };
            addedRow.getCell('clave').protection = { locked: true };
            addedRow.getCell('texto_original').protection = { locked: true };

            // Celdas editables para la dependencia
            addedRow.getCell('observaciones').protection = { locked: false };
            addedRow.getCell('observaciones').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

            addedRow.getCell('nueva_propuesta').protection = { locked: false };
            addedRow.getCell('nueva_propuesta').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };

            addedRow.alignment = { vertical: 'top', wrapText: true };
        });

        return workbook;
    }

    async analizarExcel(proyectoId, buffer) {
        const workbook = new exceljs.Workbook();
        await workbook.xlsx.load(buffer);
        const sheet = workbook.getWorksheet(1);
        const cambios = [];

        // Traer datos originales
        const originalDataMap = new Map();
        const result = await pool.query('SELECT id, texto FROM atribuciones_especificas WHERE proyecto_id = $1', [proyectoId]);
        result.rows.forEach(r => originalDataMap.set(r.id.toString(), r.texto));

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // skip header

            const id = row.getCell('A').value?.toString();
            const originalText = row.getCell('D').value?.toString() || '';
            const newText = row.getCell('F').value?.toString() || '';
            const obs = row.getCell('E').value?.toString() || '';

            if (id && newText && true) {
                const dbText = originalDataMap.get(id);
                // Si la nueva propuesta es distinta al texto que hay en la base de datos
                if (dbText !== undefined && dbText.trim() !== newText.trim()) {
                    cambios.push({
                        id: parseInt(id),
                        texto_original: dbText,
                        texto_propuesto: newText.trim(),
                        observacion: obs.trim()
                    });
                }
            }
        });

        return cambios;
    }
}

module.exports = new ExcelRevisionService();
