const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle, Spacing } = require('docx');
const pool = require('../config/db');

// Auxiliar para números ordinales en español
const ordinales = ["CERO", "PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SÉPTIMO", "OCTAVO", "NOVENO", "DÉCIMO", "UNDÉCIMO", "DUODÉCIMO"];

// Auxiliar para números romanos
const toRoman = (num) => {
    const lookup = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
    let roman = '';
    for (let i in lookup) {
        while (num >= lookup[i]) {
            roman += i;
            num -= lookup[i];
        }
    }
    return roman;
};

const exportarWord = async (proyectoId) => {
    // 1. Obtener datos
    const proyRes = await pool.query(`
        SELECT p.*, d.nombre as dep_nombre 
        FROM proyectos p JOIN dependencias d ON p.dependencia_id = d.id 
        WHERE p.id = $1`, [proyectoId]);
    const proyecto = proyRes.rows[0];

    const glosRes = await pool.query('SELECT * FROM glosario WHERE proyecto_id = $1 ORDER BY acronimo', [proyectoId]);
    const atGenRes = await pool.query('SELECT * FROM atribuciones_generales WHERE proyecto_id = $1 AND activo = true ORDER BY clave', [proyectoId]);
    const unidadesRes = await pool.query('SELECT * FROM unidades_administrativas WHERE proyecto_id = $1 ORDER BY nivel_numero ASC, orden ASC', [proyectoId]);
    const atEspRes = await pool.query('SELECT * FROM atribuciones_especificas WHERE proyecto_id = $1 AND activo = true ORDER BY clave ASC', [proyectoId]);

    const glosario = glosRes.rows;
    const atribucionesGenerales = atGenRes.rows;
    const unidades = unidadesRes.rows;
    const atribucionesEspecificas = atEspRes.rows;

    let articuloActual = 1;

    const children = [
        // Portada
        new Paragraph({
            text: proyecto.dep_nombre.toUpperCase(),
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
        }),
        new Paragraph({
            text: proyecto.nombre.toUpperCase(),
            alignment: AlignmentType.CENTER,
            spacing: { after: 800 }
        }),

        // Glosario
        new Paragraph({ text: 'GLOSARIO', heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }),
        ...glosario.map(g => new Paragraph({
            children: [
                new TextRun({ text: `${g.acronimo}: `, bold: true }),
                new TextRun(g.significado)
            ],
            spacing: { after: 100 }
        })),

        // Cuerpo del documento
        new Paragraph({ text: 'CONTENIDO ESTRUCTURAL', heading: HeadingLevel.HEADING_2, spacing: { before: 800, after: 400 } }),
    ];

    // Agrupar unidades por jerarquía
    // Nivel 1 -> Título, Nivel 2 -> Capítulo, Nivel 3 -> Sección
    let tituloCount = 0;
    let capituloCount = 0;
    let seccionCount = 0;

    unidades.forEach(u => {
        const atribs = atribucionesEspecificas.filter(a => a.unidad_id === u.id);
        if (atribs.length === 0) return;

        if (u.nivel_numero === 1) {
            tituloCount++;
            capituloCount = 0;
            seccionCount = 0;
            children.push(new Paragraph({
                text: `TÍTULO ${ordinales[tituloCount] || tituloCount}`,
                heading: HeadingLevel.HEADING_3,
                alignment: AlignmentType.CENTER,
                spacing: { before: 600, after: 200 }
            }));
            children.push(new Paragraph({
                text: u.nombre.toUpperCase(),
                heading: HeadingLevel.HEADING_3,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            }));
        } else if (u.nivel_numero === 2) {
            capituloCount++;
            seccionCount = 0;
            children.push(new Paragraph({
                text: `CAPÍTULO ${ordinales[capituloCount] || capituloCount}`,
                heading: HeadingLevel.HEADING_4,
                alignment: AlignmentType.CENTER,
                spacing: { before: 400, after: 200 }
            }));
            children.push(new Paragraph({
                text: u.nombre.toUpperCase(),
                heading: HeadingLevel.HEADING_4,
                alignment: AlignmentType.CENTER,
                spacing: { after: 300 }
            }));
        } else if (u.nivel_numero === 3) {
            seccionCount++;
            children.push(new Paragraph({
                text: `SECCIÓN ${ordinales[seccionCount] || seccionCount}`,
                alignment: AlignmentType.CENTER,
                spacing: { before: 300, after: 100 }
            }));
            children.push(new Paragraph({
                text: u.nombre.toUpperCase(),
                alignment: AlignmentType.CENTER,
                spacing: { after: 300 }
            }));
        } else {
            // Niveles inferiores como subtítulos simples
            children.push(new Paragraph({
                text: u.nombre,
                bold: true,
                spacing: { before: 300, after: 200 }
            }));
        }

        // Texto introductorio
        children.push(new Paragraph({
            text: `Al frente del ${u.nombre} se encuentra una persona titular y le corresponde el ejercicio de las siguientes atribuciones:`,
            spacing: { after: 200 },
            alignment: AlignmentType.JUSTIFY
        }));

        // Atribuciones (Articulado secuencial)
        children.push(new Paragraph({
            text: `ARTÍCULO ${articuloActual}.`,
            bold: true,
            spacing: { before: 200, after: 100 }
        }));

        atribs.forEach((a, index) => {
            children.push(new Paragraph({
                text: `${toRoman(index + 1)}. ${a.texto}`,
                spacing: { after: 100, left: 720 }, // Sangría para la lista
                alignment: AlignmentType.JUSTIFY
            }));
        });

        articuloActual++;
    });

    const doc = new Document({
        sections: [{
            properties: {},
            children
        }]
    });

    return await Packer.toBuffer(doc);
};

module.exports = { exportarWord };
