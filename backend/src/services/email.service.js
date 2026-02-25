const nodemailer = require('nodemailer');
const pool = require('../config/db');

let transporter = null;

const getTransporter = async () => {
    if (transporter) return transporter;

    const configResult = await pool.query(
        'SELECT * FROM configuracion_email WHERE activo = true LIMIT 1'
    );

    if (configResult.rows.length === 0) {
        // Modo de prueba si no hay configuración
        const account = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            auth: { user: account.user, pass: account.pass }
        });
        return transporter;
    }

    const cfg = configResult.rows[0];
    transporter = nodemailer.createTransport({
        host: cfg.smtp_host,
        port: cfg.smtp_port,
        secure: cfg.smtp_port === 465,
        auth: { user: cfg.smtp_user, pass: cfg.smtp_pass }
    });

    return transporter;
};

const enviarNotificacion = async (destinatario, asunto, cuerpo) => {
    try {
        const t = await getTransporter();
        const cfgResult = await pool.query('SELECT from_name FROM configuracion_email WHERE activo = true LIMIT 1');
        const fromName = cfgResult.rows[0]?.from_name || 'Sistema de Atribuciones';

        const info = await t.sendMail({
            from: `"${fromName}" <${process.env.EMAIL_FROM || 'no-reply@atribuciones.gob'}>`,
            to: destinatario,
            subject: asunto,
            text: cuerpo,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a3a5c; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin:0;">Sistema de Atribuciones Jerárquicas</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
          ${cuerpo.replace(/\n/g, '<br>')}
        </div>
      </div>`
        });
        console.log('Email enviado:', info.messageId);
        // Si es Ethereal, mostrar preview URL
        if (nodemailer.getTestMessageUrl(info)) {
            console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
        }
    } catch (err) {
        console.error('Error al enviar email:', err.message);
        // No lanzar error para que no interrumpa el flujo principal
    }
};

// Actualizar configuración de email
const actualizarConfig = async (req, res) => {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, from_name } = req.body;
    try {
        await pool.query('UPDATE configuracion_email SET activo = false');
        await pool.query(
            `INSERT INTO configuracion_email (smtp_host, smtp_port, smtp_user, smtp_pass, from_name, activo, updated_at)
       VALUES ($1,$2,$3,$4,$5,true,NOW())`,
            [smtp_host, smtp_port, smtp_user, smtp_pass, from_name]
        );
        transporter = null; // Reset para que se recargue
        res.json({ mensaje: 'Configuración de email actualizada' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
};

const obtenerConfig = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, smtp_host, smtp_port, smtp_user, from_name, activo FROM configuracion_email WHERE activo = true LIMIT 1'
        );
        res.json(result.rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor' });
    }
};

module.exports = { enviarNotificacion, actualizarConfig, obtenerConfig };
