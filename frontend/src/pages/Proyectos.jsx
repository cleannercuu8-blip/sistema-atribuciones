import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const TIPOS_DEP = [
    { value: 'centralizada', label: 'Dependencia Centralizada', icon: '🏢' },
    { value: 'paraestatal', label: 'Entidad Paraestatal', icon: '🏛️' },
    { value: 'organismo_autonomo', label: 'Organismo Autónomo', icon: '⚖️' },
];

export default function Proyectos() {
    const { usuario } = useAuth();
    const navigate = useNavigate();
    const [proyectos, setProyectos] = useState([]);
    const [dependencias, setDependencias] = useState([]);
    const [catResponsables, setCatResponsables] = useState([]);
    const [catEnlaces, setCatEnlaces] = useState([]);
    const [catAvances, setCatAvances] = useState([]);
    const [catEstados, setCatEstados] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [mostrarModal, setMostrarModal] = useState(false);
    const [proyectoEditar, setProyectoEditar] = useState(null);
    const [filtro, setFiltro] = useState('');
    const [form, setForm] = useState({
        nombre: '',
        dependencia_id: '',
        responsable: '',
        responsable_apoyo: '',
        enlaces: '',
        fecha_expediente: '',
        avance_id: '',
        estado_id: ''
    });
    const [guardando, setGuardando] = useState(false);

    const cargarDatos = async () => {
        try {
            const [pRes, dRes, rRes, eRes, aRes, stRes] = await Promise.all([
                api.get('/proyectos'),
                api.get('/catalogos/dependencias'),
                api.get('/catalogos/responsables'),
                api.get('/catalogos/enlaces'),
                api.get('/catalogos/avances'),
                api.get('/catalogos/estados-proyecto')
            ]);
            setProyectos(pRes.data);
            setDependencias(dRes.data);
            setCatResponsables(rRes.data);
            setCatEnlaces(eRes.data);
            setCatAvances(aRes.data);
            setCatEstados(stRes.data);
            if (usuario.rol === 'admin') {
                const uRes = await api.get('/usuarios');
                setUsuarios(uRes.data.filter(u => u.activo && u.rol !== 'admin'));
            }
        } catch (err) {
            console.error('Error cargando datos de proyectos:', err);
        }
        setCargando(false);
    };

    useEffect(() => { cargarDatos(); }, []);

    const handleCrearOEditar = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            if (proyectoEditar) {
                await api.put(`/proyectos/${proyectoEditar.id}`, form);
                setMostrarModal(false);
                setProyectoEditar(null);
                cargarDatos();
            } else {
                const res = await api.post('/proyectos', form);
                navigate(`/proyectos/${res.data.id}`);
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Error al procesar proyecto');
        }
        setGuardando(false);
    };

    const abrirEdicion = (e, p) => {
        e.stopPropagation();
        setProyectoEditar(p);
        setForm({
            nombre: p.nombre,
            dependencia_id: p.dependencia_id,
            responsable: p.responsable || '',
            responsable_apoyo: p.responsable_apoyo || '',
            enlaces: p.enlaces || '',
            fecha_expediente: p.fecha_expediente ? p.fecha_expediente.split('T')[0] : '',
            avance_id: p.avance_id || '',
            estado_id: p.estado_id || ''
        });
        setMostrarModal(true);
    };

    const handleEliminar = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('⚠️ ¿Estás seguro de eliminar este proyecto y toda su información relacionada? Esta acción es irreversible.')) return;
        try {
            await api.delete(`/proyectos/${id}`);
            cargarDatos();
            alert('✅ Proyecto eliminado');
        } catch (err) {
            alert(err.response?.data?.error || 'Error al eliminar proyecto');
        }
    };

    const puedeGestionar = (p) => {
        return usuario.rol === 'admin' || p.responsable === usuario.nombre || p.creado_por === usuario.nombre;
    };

    const proyFiltrados = proyectos.filter(p =>
        p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        p.dependencia_nombre?.toLowerCase().includes(filtro.toLowerCase())
    );

    const grupos = TIPOS_DEP.map(tipo => ({
        ...tipo,
        proyectos: proyFiltrados.filter(p => p.dependencia_tipo === tipo.value)
    }));

    const otros = proyFiltrados.filter(p => !TIPOS_DEP.find(t => t.value === p.dependencia_tipo));

    if (cargando) return <div className="loading-container"><div className="spinner" /><p>Cargando proyectos...</p></div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primario)' }}>📂 Árbol de Atribuciones</h1>
                    <p style={{ color: 'var(--color-texto-suave)', marginTop: 4 }}>Gestión y organización de proyectos</p>
                </div>
                {usuario.rol === 'admin' && (
                    <button className="btn btn-primary" onClick={() => {
                        setProyectoEditar(null);
                        setForm({ nombre: '', dependencia_id: '', responsable: '', responsable_apoyo: '', enlaces: '', fecha_expediente: '', avance_id: '', estado_id: '' });
                        setMostrarModal(true);
                    }}>
                        ➕ Nuevo proyecto
                    </button>
                )}
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
                <input
                    type="text"
                    className="form-control"
                    placeholder="🔍 Buscar por nombre o dependencia..."
                    value={filtro}
                    onChange={e => setFiltro(e.target.value)}
                />
            </div>

            {proyectos.length === 0 ? (
                <div className="empty-state card">
                    <div className="empty-icon">📋</div>
                    <h3>No hay proyectos</h3>
                    <p>Crea el primer proyecto de atribuciones para comenzar</p>
                </div>
            ) : (
                <div>
                    {grupos.map(grupo => grupo.proyectos.length > 0 && (
                        <div key={grupo.value} style={{ marginBottom: 30 }}>
                            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primario)', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                                {grupo.icon} {grupo.label} <span style={{ fontSize: 12, fontWeight: 400, background: '#eee', padding: '2px 8px', borderRadius: 10 }}>{grupo.proyectos.length}</span>
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                                {grupo.proyectos.map(p => (
                                    <div key={p.id} className="card project-card" onClick={() => navigate(`/proyectos/${p.id}`)}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primario)', flex: 1 }}>{p.nombre}</h3>
                                            <span
                                                className="badge"
                                                style={{
                                                    background: (p.estado_color || '#475569') + '20',
                                                    color: p.estado_color || '#475569',
                                                    border: `1px solid ${(p.estado_color || '#475569')}40`
                                                }}
                                            >
                                                {p.estado_nombre || 'Desconocido'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--color-texto-suave)' }}>
                                            <div style={{ marginBottom: 4 }}><strong>Responsable:</strong> {p.responsable || 'No asignado'}</div>
                                            {p.responsable_apoyo && <div style={{ marginBottom: 4 }}><strong>Apoyo:</strong> {p.responsable_apoyo}</div>}
                                            <div style={{ marginBottom: 4 }}><strong>Expediente:</strong> {p.fecha_expediente ? new Date(p.fecha_expediente).toLocaleDateString() : 'N/A'}</div>
                                            <div><strong>Avance:</strong> {p.avance_nombre || 'N/A'}</div>
                                        </div>
                                        <div style={{ marginTop: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 12, color: '#999' }}>ID: {p.id}</span>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {puedeGestionar(p) && (
                                                    <>
                                                        <button className="btn btn-outline btn-sm" onClick={(e) => abrirEdicion(e, p)}>✏️</button>
                                                        <button className="btn btn-danger btn-sm" onClick={(e) => handleEliminar(e, p.id)}>🗑️</button>
                                                    </>
                                                )}
                                                <button className="btn btn-primary btn-sm">Abrir →</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {otros.length > 0 && (
                        <div style={{ marginBottom: 30 }}>
                            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primario)', marginBottom: 15 }}>📁 Otros Proyectos</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                                {otros.map(p => (
                                    <div key={p.id} className="card project-card" onClick={() => navigate(`/proyectos/${p.id}`)}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primario)', flex: 1 }}>{p.nombre}</h3>
                                            <span
                                                className="badge"
                                                style={{
                                                    background: (p.estado_color || '#475569') + '20',
                                                    color: p.estado_color || '#475569',
                                                    border: `1px solid ${(p.estado_color || '#475569')}40`
                                                }}
                                            >
                                                {p.estado_nombre || 'Desconocido'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--color-texto-suave)' }}>
                                            <div style={{ marginBottom: 4 }}><strong>Responsable:</strong> {p.responsable || 'No asignado'}</div>
                                            {p.responsable_apoyo && <div style={{ marginBottom: 4 }}><strong>Apoyo:</strong> {p.responsable_apoyo}</div>}
                                            <div style={{ marginBottom: 4 }}><strong>Expediente:</strong> {p.fecha_expediente ? new Date(p.fecha_expediente).toLocaleDateString() : 'N/A'}</div>
                                            <div><strong>Avance:</strong> {p.avance_nombre || 'N/A'}</div>
                                        </div>
                                        <div style={{ marginTop: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 12, color: '#999' }}>ID: {p.id}</span>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {puedeGestionar(p) && (
                                                    <>
                                                        <button className="btn btn-outline btn-sm" onClick={(e) => abrirEdicion(e, p)}>✏️</button>
                                                        <button className="btn btn-danger btn-sm" onClick={(e) => handleEliminar(e, p.id)}>🗑️</button>
                                                    </>
                                                )}
                                                <button className="btn btn-primary btn-sm">Abrir →</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {mostrarModal && (
                <div className="modal-overlay" onClick={() => setMostrarModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{proyectoEditar ? '✏️ Editar Proyecto' : '➕ Nuevo Proyecto'}</h2>
                            <button className="modal-close" onClick={() => setMostrarModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCrearOEditar}>
                            <div className="form-group">
                                <label className="form-label">Nombre del proyecto <span className="required">*</span></label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={form.nombre}
                                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Dependencia/Entidad <span className="required">*</span></label>
                                    <select
                                        className="form-control"
                                        value={form.dependencia_id}
                                        onChange={e => setForm({ ...form, dependencia_id: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Seleccione --</option>
                                        {dependencias.map(d => (
                                            <option key={d.id} value={d.id}>{d.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Estado de Avance</label>
                                    <select
                                        className="form-control"
                                        value={form.avance_id}
                                        onChange={e => setForm({ ...form, avance_id: e.target.value })}
                                    >
                                        <option value="">-- Seleccione --</option>
                                        {catAvances.map(a => (
                                            <option key={a.id} value={a.id}>{a.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">👨‍💼 Responsable del proyecto (Líder)</label>
                                <select
                                    className="form-control"
                                    value={form.responsable}
                                    onChange={e => setForm({ ...form, responsable: e.target.value })}
                                    required
                                >
                                    <option value="">Seleccione un responsable...</option>
                                    {catResponsables.map(r => (
                                        <option key={r.id} value={r.nombre}>{r.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">🤝 Responsables de Apoyo</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                    {(form.responsable_apoyo ? form.responsable_apoyo.split(',').filter(x => x) : []).map((name, i) => (
                                        <span key={i} className="badge" style={{ background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 16 }}>
                                            {name}
                                            <button type="button" onClick={() => {
                                                const list = form.responsable_apoyo.split(',').filter(x => x && x !== name);
                                                setForm({ ...form, responsable_apoyo: list.join(',') });
                                            }} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: 14, color: '#94a3b8' }}>×</button>
                                        </span>
                                    ))}
                                </div>
                                <select
                                    className="form-control"
                                    value=""
                                    onChange={e => {
                                        if (!e.target.value) return;
                                        const current = form.responsable_apoyo ? form.responsable_apoyo.split(',').filter(x => x) : [];
                                        if (!current.includes(e.target.value)) {
                                            setForm({ ...form, responsable_apoyo: [...current, e.target.value].join(',') });
                                        }
                                    }}
                                >
                                    <option value="">+ Agregar responsable de apoyo...</option>
                                    {catResponsables.map(r => (
                                        <option key={r.id} value={r.nombre}>{r.nombre}</option>
                                    ))}
                                </select>
                                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Puedes seleccionar varios responsables de apoyo.</p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">📧 Persona enlace</label>
                                <select
                                    className="form-control"
                                    value={form.enlaces}
                                    onChange={e => setForm({ ...form, enlaces: e.target.value })}
                                    required
                                >
                                    <option value="">Seleccione un enlace...</option>
                                    {catEnlaces.map(en => (
                                        <option key={en.id} value={en.nombre}>{en.nombre} ({en.email})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Estado del Proyecto <span className="required">*</span></label>
                                <select
                                    className="form-control"
                                    value={form.estado_id}
                                    onChange={e => setForm({ ...form, estado_id: e.target.value })}
                                    required
                                >
                                    <option value="">-- Seleccione Estado --</option>
                                    {catEstados.map(st => (
                                        <option key={st.id} value={st.id}>{st.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Fecha de Expediente</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={form.fecha_expediente}
                                    onChange={e => setForm({ ...form, fecha_expediente: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                                <button type="button" className="btn btn-outline" onClick={() => setMostrarModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={guardando}>
                                    {guardando ? '⏳ Guardando...' : proyectoEditar ? '💾 Guardar Cambios' : '✅ Crear Proyecto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
