const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle } = require('docx');
const pool = require('../config/db');

/**
 * Genera un documento de Word con el contenido del proyecto
 */
const exportarWord = async (proyectoId) => {
    // 1. Obtener datos básicos
    const proyResult = await pool.query(
        `SELECT p.*, d.nombre as dep_nombre, d.siglas as dep_siglas 
         FROM proyectos p JOIN dependencias d ON p.dependencia_id = d.id WHERE p.id = $1`,
        [proyectoId]
    );
    const proyecto = proyResult.rows[0];

    // 2. Obtener Glosario
    const glosResult = await pool.query(
        'SELECT * FROM glosario WHERE proyecto_id = $1 ORDER BY acronimo',
        [proyectoId]
    );

    // 3. Obtener Atribuciones Generales
    const atGenResult = await pool.query(
        'SELECT * FROM atribuciones_generales WHERE proyecto_id = $1 AND activo = true ORDER BY clave',
        [proyectoId]
    );

    // 4. Obtener Unidades y Atribuciones Específicas
    const unidadesResult = await pool.query(
        'SELECT * FROM unidades_administrativas WHERE proyecto_id = $1 ORDER BY nivel_numero, orden',
        [proyectoId]
    );
    const unidades = unidadesResult.rows;

    const atEspResult = await pool.query(
        `SELECT ae.*, ag.clave as gen_clave 
         FROM atribuciones_especificas ae
         LEFT JOIN atribuciones_generales ag ON ae.atribucion_general_id = ag.id
         WHERE ae.proyecto_id = $1 AND ae.activo = true`,
        [proyectoId]
    );
    const atribucionesEspecíficas = atEspResult.rows;

    // --- CONSTRUCCIÓN DEL DOCUMENTO ---
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                // Portada / Título
                new Paragraph({
                    text: proyecto.dep_nombre.toUpperCase(),
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                    text: 'PROPUESTA DE ATRIBUCIONES JERÁRQUICAS',
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 200, after: 400 },
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: `Proyecto: `, bold: true }),
                        new TextRun(proyecto.nombre),
                    ],
                    spacing: { after: 800 },
                }),

                // SECCIÓN: GLOSARIO
                new Paragraph({ text: 'I. GLOSARIO DE ACRÓNIMOS', heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ text: 'ACRÓNIMO', bold: true })], width: { size: 20, type: WidthType.PERCENTAGE } }),
                                new TableCell({ children: [new Paragraph({ text: 'SIGNIFICADO', bold: true })], width: { size: 80, type: WidthType.PERCENTAGE } }),
                            ],
                        }),
                        ...glosResult.rows.map(g => new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph(g.acronimo)] }),
                                new TableCell({ children: [new Paragraph(g.significado)] }),
                            ],
                        })),
                    ],
                }),

                // SECCIÓN: BASE LEGAL (ATRIBUCIONES GENERALES)
                new Paragraph({ text: 'II. ATRIBUCIONES GENERALES (BASE LEGAL)', heading: HeadingLevel.HEADING_2, spacing: { before: 600, after: 200 } }),
                ...atGenResult.rows.map(ag => new Paragraph({
                    children: [
                        new TextRun({ text: `${ag.clave}. `, bold: true }),
                        new TextRun({ text: `${ag.norma}, Art. ${ag.articulo}: `, italic: true }),
                        new TextRun(ag.texto),
                    ],
                    spacing: { after: 200 },
                    alignment: AlignmentType.JUSTIFY,
                })),

                // SECCIÓN: ATRIBUCIONES POR UNIDAD
                new Paragraph({ text: 'III. ATRIBUCIONES POR UNIDAD ADMINISTRATIVA', heading: HeadingLevel.HEADING_2, spacing: { before: 600, after: 400 } }),

                // Iterar por unidades
                ...unidades.flatMap(unidad => {
                    const atribs = atribucionesEspecíficas.filter(ae => ae.unidad_id === unidad.id);
                    if (atribs.length === 0) return [];

                    return [
                        new Paragraph({
                            children: [
                                new TextRun({ text: `${unidad.siglas} - ${unidad.nombre}`, bold: true, size: 28 }),
                            ],
                            heading: HeadingLevel.HEADING_3,
                            spacing: { before: 400, after: 200 },
                            border: { bottom: { color: 'auto', space: 1, style: BorderStyle.SINGLE, size: 6 } }
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: [
                                new TableRow({
                                    children: [
                                        new TableCell({ children: [new Paragraph({ text: 'ID', bold: true })], width: { size: 10, type: WidthType.PERCENTAGE } }),
                                        new TableCell({ children: [new Paragraph({ text: 'ATRIBUCIÓN', bold: true })], width: { size: 70, type: WidthType.PERCENTAGE } }),
                                        new TableCell({ children: [new Paragraph({ text: 'REF. LEGAL', bold: true })], width: { size: 20, type: WidthType.PERCENTAGE } }),
                                    ],
                                }),
                                ...atribs.map(a => new TableRow({
                                    children: [
                                        new TableCell({ children: [new Paragraph(a.clave)] }),
                                        new TableCell({ children: [new Paragraph({ text: a.texto, alignment: AlignmentType.JUSTIFY })] }),
                                        new TableCell({ children: [new Paragraph(a.gen_clave || 'N/A')] }),
                                    ],
                                })),
                            ],
                        }),
                    ];
                }),
            ],
        }],
    });

    return await Packer.toBuffer(doc);
};

module.exports = { exportarWord };
