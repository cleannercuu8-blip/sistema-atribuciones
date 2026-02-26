const ExcelJS = require('exceljs');
const pool = require('../config/db');

// Colores institucionales
const COLOR_HEADER = '1a3a5c';
const COLOR_SUBHEADER = '4a7db5';
const COLOR_ACCENT = 'c9daf8';
const COLOR_WHITE = 'FFFFFF';

const estiloHeader = (cell, texto) => {
    cell.value = texto;
    cell.font = { bold: true, color: { argb: COLOR_WHITE }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
        top: { style: 'thin', color: { argb: 'cccccc' } },
        bottom: { style: 'thin', color: { argb: 'cccccc' } },
        left: { style: 'thin', color: { argb: 'cccccc' } },
        right: { style: 'thin', color: { argb: 'cccccc' } }
    };
};

const estiloSubHeader = (cell, texto) => {
    cell.value = texto;
    cell.font = { bold: true, color: { argb: COLOR_WHITE }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SUBHEADER } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
};

const estiloCelda = (cell, texto, color = null) => {
    cell.value = texto || '';
    cell.alignment = { vertical: 'top', wrapText: true };
    cell.border = {
        top: { style: 'hair', color: { argb: 'cccccc' } },
        bottom: { style: 'hair', color: { argb: 'cccccc' } },
        left: { style: 'hair', color: { argb: 'cccccc' } },
        right: { style: 'hair', color: { argb: 'cccccc' } }
    };
    if (color) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    }
};

const estiloCeldaVerde = (cell, texto) => {
    estiloCelda(cell, texto, '22c55e'); // Verde más intenso (Tailwind success-500 approx)
};

const exportarExcel = async (proyectoId) => {
    const workbook = new ExcelJS.Workbook();

    // Obtener datos del proyecto
    const proyResult = await pool.query(
        `SELECT p.*, d.nombre as dep_nombre, d.siglas as dep_siglas, d.tipo as dep_tipo
     FROM proyectos p JOIN dependencias d ON p.dependencia_id = d.id WHERE p.id = $1`,
        [proyectoId]
    );
    const proyecto = proyResult.rows[0];

    // Obtener unidades (árbol)
    const unidadesResult = await pool.query(
        `SELECT * FROM unidades_administrativas WHERE proyecto_id = $1 ORDER BY nivel_numero ASC, orden ASC`,
        [proyectoId]
    );
    const unidades = unidadesResult.rows;

    // Obtener atribuciones generales
    const atGenResult = await pool.query(
        `SELECT * FROM atribuciones_generales WHERE proyecto_id = $1 AND activo = true ORDER BY clave`,
        [proyectoId]
    );
    const atriGenerales = atGenResult.rows;

    // Obtener atribuciones específicas con cadena completa
    const atEspResult = await pool.query(
        `SELECT ae.*, ua.nombre as unidad_nombre, ua.siglas as unidad_siglas, ua.nivel_numero,
            ag.clave as gen_clave, ag.texto as gen_texto, ag.norma, ag.articulo, ag.fraccion_parrafo,
            ua.padre_id as unidad_padre_id
     FROM atribuciones_especificas ae
     JOIN unidades_administrativas ua ON ae.unidad_id = ua.id
     LEFT JOIN atribuciones_generales ag ON ae.atribucion_general_id = ag.id
     WHERE ae.proyecto_id = $1 AND ae.activo = true
     ORDER BY ua.nivel_numero ASC, ae.clave ASC`,
        [proyectoId]
    );
    const atriEspecificas = atEspResult.rows;

    // Obtener glosario
    const glosResult = await pool.query(
        'SELECT * FROM glosario WHERE proyecto_id = $1 ORDER BY acronimo',
        [proyectoId]
    );

    // ===== HOJA: ORGANIGRAMA =====
    const wsOrg = workbook.addWorksheet('ORGANIGRAMA');
    wsOrg.getColumn('A').width = 5;
    wsOrg.getColumn('B').width = 40;
    wsOrg.getColumn('C').width = 15;
    wsOrg.getColumn('D').width = 40;

    // Título
    wsOrg.mergeCells('A1:D1');
    estiloHeader(wsOrg.getCell('A1'), `ORGANIGRAMA - ${proyecto.dep_nombre}`);
    wsOrg.getRow(1).height = 30;

    wsOrg.getCell('A3').value = 'NIVEL';
    wsOrg.getCell('B3').value = 'UNIDAD ADMINISTRATIVA';
    wsOrg.getCell('C3').value = 'SIGLAS';
    wsOrg.getCell('D3').value = 'DEPENDE DE';
    ['A3', 'B3', 'C3', 'D3'].forEach(c => estiloSubHeader(wsOrg.getCell(c), wsOrg.getCell(c).value));
    wsOrg.getRow(3).height = 25;

    let fOrg = 4;
    for (const u of unidades) {
        const padre = unidades.find(x => x.id === u.padre_id);
        wsOrg.getCell(`A${fOrg}`).value = u.nivel_numero;
        estiloCelda(wsOrg.getCell(`B${fOrg}`), u.nombre);
        estiloCelda(wsOrg.getCell(`C${fOrg}`), u.siglas);
        estiloCelda(wsOrg.getCell(`D${fOrg}`), padre ? `${padre.nombre} (${padre.siglas})` : 'N/A - Nivel Base');
        fOrg++;
    }

    // ===== HOJA: GLOSARIOS =====
    const wsGlos = workbook.addWorksheet('GLOSARIOS');
    wsGlos.getColumn('A').width = 20;
    wsGlos.getColumn('B').width = 60;
    wsGlos.mergeCells('A1:B1');
    estiloHeader(wsGlos.getCell('A1'), 'GLOSARIO DE ACRÓNIMOS');
    wsGlos.getRow(1).height = 30;
    estiloSubHeader(wsGlos.getCell('A2'), 'ACRÓNIMO');
    estiloSubHeader(wsGlos.getCell('B2'), 'SIGNIFICADO');
    let fGlos = 3;
    for (const g of glosResult.rows) {
        estiloCelda(wsGlos.getCell(`A${fGlos}`), g.acronimo);
        estiloCelda(wsGlos.getCell(`B${fGlos}`), g.significado);
        fGlos++;
    }

    // ===== HOJA: ATRIBUCIONES GENERALES =====
    const wsAG = workbook.addWorksheet('ATRIBUCIONES GENERALES');
    wsAG.getColumn('A').width = 10;
    wsAG.getColumn('B').width = 20;
    wsAG.getColumn('C').width = 15;
    wsAG.getColumn('D').width = 20;
    wsAG.getColumn('E').width = 70;
    wsAG.mergeCells('A1:E1');
    estiloHeader(wsAG.getCell('A1'), `ATRIBUCIONES GENERALES - ${proyecto.dep_nombre}`);
    wsAG.getRow(1).height = 30;
    wsAG.mergeCells('A2:E2');
    wsAG.getCell('A2').value = 'Capturar de ley orgánica, decreto de creación, normas generales, etc., las atribuciones, facultades, obligaciones y actividades.';
    wsAG.getCell('A2').font = { italic: true, size: 9 };
    ['A3', 'B3', 'C3', 'D3', 'E3'].forEach((c, i) => {
        estiloSubHeader(wsAG.getCell(c), ['CLAVE', 'NORMA', 'ARTÍCULO', 'FRACCIÓN/PÁRRAFO', 'TEXTO'][i]);
    });
    wsAG.getRow(3).height = 25;
    let fAG = 4;
    for (const a of atriGenerales) {
        estiloCelda(wsAG.getCell(`A${fAG}`), a.clave);
        estiloCelda(wsAG.getCell(`B${fAG}`), a.norma);
        estiloCelda(wsAG.getCell(`C${fAG}`), a.articulo);
        estiloCelda(wsAG.getCell(`D${fAG}`), a.fraccion_parrafo);
        estiloCelda(wsAG.getCell(`E${fAG}`), a.texto);
        fAG++;
    }

    // ===== HOJAS POR NIVEL =====
    // Obtener niveles únicos ordenados
    const nivelesUnicos = [...new Set(unidades.map(u => u.nivel_numero))].sort((a, b) => a - b);

    // Mapa de atribuciones por ID (usando String para evitar problemas de tipos)
    const atriMap = {};
    atriEspecificas.forEach(a => { atriMap[String(a.id)] = a; });

    // Ids de atribuciones que son padres (superior jerárquico) de otras en este proyecto
    const idsConHijos = new Set();
    atriEspecificas.forEach(a => {
        if (a.padre_atribucion_id) {
            idsConHijos.add(String(a.padre_atribucion_id));
        }
    });

    // Mapa de unidades por ID
    const unidadesMap = {};
    unidades.forEach(u => { unidadesMap[String(u.id)] = u; });

    for (const nivel of nivelesUnicos) {
        const unidadesNivel = unidades.filter(u => u.nivel_numero === nivel);

        for (const unidad of unidadesNivel) {
            const wsName = unidad.siglas.substring(0, 31); // Excel max 31 chars
            const ws = workbook.addWorksheet(wsName);

            const atribUnidad = atriEspecificas.filter(a => a.unidad_id === unidad.id);

            // Construir cadena de niveles para esta hoja (desde nivel 0 hasta este nivel)
            const cadena = obtenerCadena(unidad, unidadesMap);
            const numColumnas = cadena.length * 2 + 1; // clave + texto por cada nivel + corresponsabilidad

            // Título
            const ultimaCol = getColumnLetter(numColumnas);
            ws.mergeCells(`A1:${ultimaCol}1`);
            estiloHeader(ws.getCell('A1'), `ATRIBUCIONES ESPECÍFICAS - nivel ${nivel}`);
            ws.getRow(1).height = 30;

            // Descripción
            ws.mergeCells(`A2:${ultimaCol}2`);
            ws.getCell('A2').value = `Se deberán capturar las atribuciones específicas. En la columna "NUM. IDENTIFICADOR" seleccione la atribución de su superior jerárquico que corresponda a su atribución específica.`;
            ws.getCell('A2').font = { italic: true, size: 9 };

            // Encabezados de columnas (una columna CLAVE, una TEXTO por nivel)
            let colIdx = 1;
            for (const nv of cadena) {
                const c1 = getColumnLetter(colIdx);
                const c2 = getColumnLetter(colIdx + 1);
                estiloSubHeader(ws.getCell(`${c1}3`), 'CLAVE');
                estiloSubHeader(ws.getCell(`${c2}3`), nv.nivel_numero === 0
                    ? `ORIGEN DE LA ATRIBUCIÓN`
                    : `ATRIBUCIONES ESPECÍFICAS\n${nv.nombre.toUpperCase()}`);
                ws.getColumn(colIdx).width = 12;
                ws.getColumn(colIdx + 1).width = 45;
                colIdx += 2;
            }
            // Columna Corresponsabilidad
            const colCorr = getColumnLetter(colIdx);
            estiloSubHeader(ws.getCell(`${colCorr}3`), 'CORRESPONSABILIDAD');
            ws.getColumn(colIdx).width = 25;
            ws.getRow(3).height = 35;

            // Filas de datos
            let fila = 4;
            for (const atr of atribUnidad) {
                // Mapear atribuciones por nivel para esta fila
                const atribsPorNivel = {};
                atribsPorNivel[nivel] = { clave: atr.clave, texto: atr.texto };

                // Subir por la jerarquía para llenar los niveles superiores siguiendo el rastro explicitamente
                let actual = atr;
                // Límite de seguridad para evitar bucles infinitos
                let safety = 0;
                while (actual.padre_atribucion_id && atriMap[String(actual.padre_atribucion_id)] && safety < 50) {
                    actual = atriMap[String(actual.padre_atribucion_id)];
                    // Obtener nivel real: prioridad al nivel_numero guardado, luego al de la unidad
                    const n = actual.nivel_numero !== undefined ? actual.nivel_numero : (actual.unidad_id ? unidadesMap[String(actual.unidad_id)]?.nivel_numero : null);
                    if (n !== null) {
                        atribsPorNivel[n] = { clave: actual.clave, texto: actual.texto };
                    }
                    safety++;
                }

                // Atribución General (Ley - Nivel 0)
                // Se busca el vinculo final de la ley en toda la cadena encontrada
                let idLey = atr.atribucion_general_id;
                if (!idLey) {
                    // Si no tiene vinculo directo, puede que algun padre si lo tenga
                    let aux = atr;
                    safety = 0;
                    while (aux.padre_atribucion_id && atriMap[String(aux.padre_atribucion_id)] && safety < 50) {
                        aux = atriMap[String(aux.padre_atribucion_id)];
                        if (aux.atribucion_general_id) {
                            idLey = aux.atribucion_general_id;
                            break;
                        }
                        safety++;
                    }
                }

                if (idLey) {
                    const gen = atriGenerales.find(g => String(g.id) === String(idLey));
                    if (gen) atribsPorNivel[0] = { clave: gen.clave, texto: gen.texto };
                }

                // Escribir en las celdas siguiendo la 'cadena' de la unidad
                let c = 1;
                for (const nv of cadena) {
                    const data = atribsPorNivel[nv.nivel_numero];
                    // Orden: CLAVE primero, luego TEXTO
                    estiloCelda(ws.getCell(`${getColumnLetter(c)}${fila}`), data?.clave || '-');
                    estiloCelda(ws.getCell(`${getColumnLetter(c + 1)}${fila}`), data?.texto || '-');
                    c += 2;
                }
                // Corresponsabilidad (Verde si se está "bajando", es decir, si es el padre de otra atribución)
                const cellCorrValue = ws.getCell(`${getColumnLetter(c)}${fila}`);
                if (idsConHijos.has(String(atr.id))) {
                    // Sin guión si está coloreado y vacío
                    estiloCeldaVerde(cellCorrValue, atr.corresponsabilidad || '');
                } else {
                    estiloCelda(cellCorrValue, atr.corresponsabilidad || '-');
                }
                fila++;
            }
        }
    }

    return workbook;
};

// Obtener la cadena de unidades desde la raíz hasta la unidad actual
const obtenerCadena = (unidad, mapaUnidades) => {
    const cadena = [];
    let actual = unidad;
    while (actual) {
        cadena.unshift(actual);
        actual = actual.padre_id ? mapaUnidades[actual.padre_id] : null;
    }
    // Siempre añadir el "Nivel 0" (Base legal) al inicio si no existe
    if (cadena.length === 0 || cadena[0].nivel_numero !== 0) {
        cadena.unshift({ nivel_numero: 0, nombre: 'ORIGEN DE LA ATRIBUCIÓN', siglas: 'LEY' });
    }
    return cadena;
};

// Convertir número de columna a letra (A, B, ..., Z, AA, ...)
const getColumnLetter = (n) => {
    let result = '';
    while (n > 0) {
        const remainder = (n - 1) % 26;
        result = String.fromCharCode(65 + remainder) + result;
        n = Math.floor((n - 1) / 26);
    }
    return result;
};

module.exports = { exportarExcel };
