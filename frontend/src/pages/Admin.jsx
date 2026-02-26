import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ROLES = [
    { value: 'admin', label: 'Administrador' },
    { value: 'revisor', label: 'Revisor / Responsable' },
    { value: 'visualizador', label: 'Visualizador' },
    { value: 'enlace', label: 'Enlace' }
];
const TIPOS_DEP = [
    { value: 'centralizada', label: 'Dependencia' },
    { value: 'paraestatal', label: 'Entidad' },
    { value: 'organismo_autonomo', label: 'Organismo Autónomo' },
    { value: 'otro', label: 'Otro' },
];

export default function Admin() {
    const [tabAdmin, setTabAdmin] = useState('usuarios');
    const [usuarios, setUsuarios] = useState([]);
    const [dependencias, setDependencias] = useState([]);
    const [emailConfig, setEmailConfig] = useState({});
    const [mostrarModalU, setMostrarModalU] = useState(false);
    const [mostrarModalD, setMostrarModalD] = useState(false);
    const [editandoU, setEditandoU] = useState(null);
    const [editandoD, setEditandoD] = useState(null);
    const [formU, setFormU] = useState({ nombre: '', email: '', password: '', rol: 'revisor', activo: true });
    const [formD, setFormD] = useState({ nombre: '', siglas: '', tipo: 'centralizada', descripcion: '' });
    const [formEmail, setFormEmail] = useState({ smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '', from_name: 'Sistema de Atribuciones' });
    const [guardandoEmail, setGuardandoEmail] = useState(false);
    const [msgEmail, setMsgEmail] = useState('');
    const { usuario } = useAuth();

    const getRolLabel = (rol) => {
        return ROLES.find(r => r.value === rol)?.label || rol;
    };

    const cargar = async () => {
        try {
            const [uRes, dRes, eRes] = await Promise.all([
                api.get('/usuarios'),
                api.get('/dependencias'),
                api.get('/admin/email-config'),
            ]);
            setUsuarios(uRes.data);
            setDependencias(dRes.data);
            if (eRes.data) setFormEmail(prev => ({ ...prev, ...eRes.data }));
        } catch { }
    };

    useEffect(() => { cargar(); }, []);

    const guardarUsuario = async (e) => {
        e.preventDefault();
        try {
            if (editandoU) {
                await api.put(`/usuarios/${editandoU.id}`, formU);
            } else {
                await api.post('/usuarios', formU);
            }
            setMostrarModalU(false);
            cargar();
        } catch (err) { alert(err.response?.data?.error || 'Error'); }
    };

    const guardarDependencia = async (e) => {
        e.preventDefault();
        try {
            if (editandoD) {
                await api.put(`/dependencias/${editandoD.id}`, formD);
            } else {
                await api.post('/dependencias', formD);
            }
            setMostrarModalD(false);
            cargar();
        } catch (err) { alert(err.response?.data?.error || 'Error'); }
    };

    const guardarEmail = async (e) => {
        e.preventDefault();
        setGuardandoEmail(true);
        try {
            await api.put('/admin/email-config', formEmail);
            setMsgEmail('✅ Configuración guardada correctamente');
        } catch { setMsgEmail('❌ Error al guardar'); }
        setGuardandoEmail(false);
    };

    const abrirModalU = (u = null) => {
        setEditandoU(u);
        setFormU(u ? { nombre: u.nombre, email: u.email, password: '', rol: u.rol, activo: u.activo } : { nombre: '', email: '', password: '', rol: 'revisor', activo: true });
        setMostrarModalU(true);
    };

    const abrirModalD = (d = null) => {
        setEditandoD(d);
        setFormD(d ? { nombre: d.nombre, siglas: d.siglas || '', tipo: d.tipo, descripcion: d.descripcion || '' } : { nombre: '', siglas: '', tipo: 'centralizada', descripcion: '' });
        setMostrarModalD(true);
    };

    const eliminarUsuario = async (id) => {
        if (!window.confirm('¿Eliminar definitivamente este usuario?')) return;
        try {
            await api.delete(`/usuarios/${id}`);
            cargar();
        } catch { alert('Error al eliminar'); }
    };

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primario)' }}>⚙️ Panel de Administración</h1>
                <p style={{ color: 'var(--color-texto-suave)' }}>Gestión de usuarios, dependencias y configuración del sistema</p>
            </div>

            <div className="tabs">
                {['usuarios', 'dependencias', 'email'].map(t => (
                    <button key={t} className={`tab-btn ${tabAdmin === t ? 'active' : ''}`} onClick={() => setTabAdmin(t)}>
                        {t === 'usuarios' && '👥 Usuarios'}
                        {t === 'dependencias' && '🏢 Dependencias'}
                        {t === 'email' && '📧 Email / Notificaciones'}
                    </button>
                ))}
            </div>

            {/* ===== USUARIOS ===== */}
            {tabAdmin === 'usuarios' && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">👥 Usuarios del sistema</span>
                        <button className="btn btn-primary btn-sm" onClick={() => abrirModalU()} id="btn-nuevo-usuario">➕ Nuevo usuario</button>
                    </div>
                    <div className="table-responsive">
                        <table>
                            <thead>
                                <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr>
                            </thead>
                            <tbody>
                                {usuarios.map(u => (
                                    <tr key={u.id}>
                                        <td><strong>{u.nombre}</strong></td>
                                        <td>{u.email}</td>
                                        <td><span className={`badge badge-${u.rol}`}>{getRolLabel(u.rol)}</span></td>
                                        <td><span className="badge badge-aprobado">Activo</span></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn btn-outline btn-icon btn-sm" onClick={() => abrirModalU(u)}>✏️</button>
                                                {u.id !== usuario?.id && (
                                                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => eliminarUsuario(u.id)}>🗑️</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ===== DEPENDENCIAS ===== */}
            {tabAdmin === 'dependencias' && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">🏢 Dependencias y Entidades</span>
                        <button className="btn btn-primary btn-sm" onClick={() => abrirModalD()} id="btn-nueva-dependencia">➕ Nueva dependencia</button>
                    </div>
                    <div className="table-responsive">
                        <table>
                            <thead>
                                <tr><th>Nombre</th><th>Siglas</th><th>Tipo</th><th>Acciones</th></tr>
                            </thead>
                            <tbody>
                                {dependencias.map(d => (
                                    <tr key={d.id}>
                                        <td><strong>{d.nombre}</strong></td>
                                        <td>{d.siglas || '-'}</td>
                                        <td>
                                            <span className="badge badge-dependencia">
                                                {TIPOS_DEP.find(t => t.value === d.tipo)?.label || d.tipo}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn btn-outline btn-icon btn-sm" onClick={() => abrirModalD(d)}>✏️</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ===== EMAIL ===== */}
            {tabAdmin === 'email' && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">📧 Configuración de Correo Electrónico</span>
                    </div>
                    <div className="alert alert-info">
                        ℹ️ Configure el servidor SMTP para enviar notificaciones. Puede usar Gmail, Outlook u otro proveedor de correo.
                    </div>
                    {msgEmail && <div className={`alert ${msgEmail.includes('✅') ? 'alert-success' : 'alert-error'}`}>{msgEmail}</div>}
                    <form onSubmit={guardarEmail}>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Servidor SMTP (Host)</label>
                                <input className="form-control" value={formEmail.smtp_host} onChange={e => setFormEmail({ ...formEmail, smtp_host: e.target.value })} placeholder="smtp.gmail.com" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Puerto</label>
                                <input type="number" className="form-control" value={formEmail.smtp_port} onChange={e => setFormEmail({ ...formEmail, smtp_port: parseInt(e.target.value) })} placeholder="587" />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Usuario / Email remitente</label>
                                <input type="email" className="form-control" value={formEmail.smtp_user} onChange={e => setFormEmail({ ...formEmail, smtp_user: e.target.value })} placeholder="notificaciones@dominio.gob" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Contraseña / App Password</label>
                                <input type="password" className="form-control" value={formEmail.smtp_pass} onChange={e => setFormEmail({ ...formEmail, smtp_pass: e.target.value })} placeholder="••••••••••••" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Nombre del remitente</label>
                            <input className="form-control" value={formEmail.from_name} onChange={e => setFormEmail({ ...formEmail, from_name: e.target.value })} placeholder="Sistema de Atribuciones" />
                        </div>
                        <div className="alert alert-warning" style={{ marginTop: 12 }}>
                            ⚠️ <strong>Para Gmail:</strong> Necesita habilitar "Contraseñas de aplicación" en su cuenta Google con 2FA activo.
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={guardandoEmail}>
                            {guardandoEmail ? '⏳ Guardando...' : '💾 Guardar configuración'}
                        </button>
                    </form>
                </div>
            )}

            {/* Modal usuario */}
            {mostrarModalU && (
                <div className="modal-overlay" onClick={() => setMostrarModalU(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editandoU ? '✏️ Editar usuario' : '➕ Nuevo usuario'}</h2>
                            <button className="modal-close" onClick={() => setMostrarModalU(false)}>×</button>
                        </div>
                        <form onSubmit={guardarUsuario}>
                            <div className="form-group">
                                <label className="form-label">Nombre completo <span className="required">*</span></label>
                                <input className="form-control" value={formU.nombre} onChange={e => setFormU({ ...formU, nombre: e.target.value })} required placeholder="Juan Pérez García" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email <span className="required">*</span></label>
                                <input type="email" className="form-control" value={formU.email} onChange={e => setFormU({ ...formU, email: e.target.value })} required placeholder="usuario@correo.com" />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">{editandoU ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
                                    <input type="password" className="form-control" value={formU.password} onChange={e => setFormU({ ...formU, password: e.target.value })} required={!editandoU} placeholder="••••••••" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Rol <span className="required">*</span></label>
                                    <select className="form-control" value={formU.rol} onChange={e => setFormU({ ...formU, rol: e.target.value })}>
                                        {ROLES.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn btn-outline" onClick={() => setMostrarModalU(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" id="btn-guardar-usuario">✅ {editandoU ? 'Actualizar' : 'Crear'} usuario</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal dependencia */}
            {mostrarModalD && (
                <div className="modal-overlay" onClick={() => setMostrarModalD(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editandoD ? '✏️ Editar dependencia' : '➕ Nueva dependencia'}</h2>
                            <button className="modal-close" onClick={() => setMostrarModalD(false)}>×</button>
                        </div>
                        <form onSubmit={guardarDependencia}>
                            <div className="form-group">
                                <label className="form-label">Nombre completo <span className="required">*</span></label>
                                <input className="form-control" value={formD.nombre} onChange={e => setFormD({ ...formD, nombre: e.target.value })} required placeholder="Secretaría de Educación y Cultura" />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Siglas</label>
                                    <input className="form-control" value={formD.siglas} onChange={e => setFormD({ ...formD, siglas: e.target.value.toUpperCase() })} placeholder="SEC" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tipo <span className="required">*</span></label>
                                    <select className="form-control" value={formD.tipo} onChange={e => setFormD({ ...formD, tipo: e.target.value })}>
                                        {TIPOS_DEP.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Descripción</label>
                                <textarea className="form-control" rows={2} value={formD.descripcion} onChange={e => setFormD({ ...formD, descripcion: e.target.value })} placeholder="Descripción opcional..." />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn btn-outline" onClick={() => setMostrarModalD(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" id="btn-guardar-dependencia">✅ {editandoD ? 'Actualizar' : 'Crear'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
