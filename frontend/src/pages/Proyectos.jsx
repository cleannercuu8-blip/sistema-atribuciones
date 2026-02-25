import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const TIPOS_DEP = [
    { value: 'centralizada', label: 'Dependencia Centralizada' },
    { value: 'paraestatal', label: 'Entidad Paraestatal' },
    { value: 'organismo_autonomo', label: 'Organismo Autónomo' },
    { value: 'otro', label: 'Otro' },
];

export default function Proyectos() {
    const { usuario } = useAuth();
    const navigate = useNavigate();
    const [proyectos, setProyectos] = useState([]);
    const [dependencias, setDependencias] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [mostrarModal, setMostrarModal] = useState(false);
    const [filtro, setFiltro] = useState('');
    const [form, setForm] = useState({ nombre: '', dependencia_id: '' });
    const [guardando, setGuardando] = useState(false);

    const cargarDatos = async () => {
        try {
            const [pRes, dRes] = await Promise.all([
                api.get('/proyectos'),
                api.get('/dependencias'),
            ]);
            setProyectos(pRes.data);
            setDependencias(dRes.data);
            if (usuario.rol === 'admin') {
                const uRes = await api.get('/usuarios');
                setUsuarios(uRes.data.filter(u => u.activo && u.rol !== 'admin'));
            }
        } catch { }
        setCargando(false);
    };

    useEffect(() => { cargarDatos(); }, []);

    const handleCrear = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            const res = await api.post('/proyectos', form);
            navigate(`/proyectos/${res.data.id}`);
        } catch (err) {
            alert(err.response?.data?.error || 'Error al crear proyecto');
        }
        setGuardando(false);
    };

    const proyFiltrados = proyectos.filter(p =>
        p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        p.dependencia_nombre?.toLowerCase().includes(filtro.toLowerCase())
    );

    if (cargando) return <div className="loading-container"><div className="spinner" /><p>Cargando proyectos...</p></div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primario)' }}>📁 Proyectos de Atribuciones</h1>
                    <p style={{ color: 'var(--color-texto-suave)', marginTop: 4 }}>Gestión de proyectos por dependencia</p>
                </div>
                {usuario.rol === 'admin' && (
                    <button className="btn btn-primary" onClick={() => setMostrarModal(true)} id="btn-nuevo-proyecto">
                        ➕ Nuevo proyecto
                    </button>
                )}
            </div>

            {/* Buscador */}
            <div className="card" style={{ marginBottom: 20 }}>
                <input
                    type="text"
                    className="form-control"
                    placeholder="🔍 Buscar por nombre o dependencia..."
                    value={filtro}
                    onChange={e => setFiltro(e.target.value)}
                />
            </div>

            {/* Lista */}
            {proyFiltrados.length === 0 ? (
                <div className="empty-state card">
                    <div className="empty-icon">📋</div>
                    <h3>No hay proyectos</h3>
                    <p>{filtro ? 'No se encontraron resultados para la búsqueda' : 'Crea el primer proyecto de atribuciones'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {proyFiltrados.map(p => (
                        <div key={p.id} className="card" style={{ borderTop: `4px solid ${p.estado === 'aprobado' ? '#27ae60' : p.estado === 'en_revision' ? '#f39c12' : '#4a7db5'}`, cursor: 'pointer' }}
                            onClick={() => navigate(`/proyectos/${p.id}`)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primario)', flex: 1 }}>{p.nombre}</h3>
                                <span className={`badge badge-${p.estado}`}>
                                    {p.estado === 'borrador' ? '✏️ Borrador' : p.estado === 'en_revision' ? '🔍 En revisión' : '✅ Aprobado'}
                                </span>
                            </div>
                            <p style={{ fontSize: 13, color: 'var(--color-texto-suave)' }}>
                                🏢 {p.dependencia_nombre}
                            </p>
                            <p style={{ fontSize: 12, color: 'var(--color-texto-suave)', marginTop: 6 }}>
                                📅 {new Date(p.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <div style={{ marginTop: 12, textAlign: 'right' }}>
                                <button className="btn btn-outline btn-sm">Abrir proyecto →</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal nuevo proyecto */}
            {mostrarModal && (
                <div className="modal-overlay" onClick={() => setMostrarModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">➕ Nuevo proyecto</h2>
                            <button className="modal-close" onClick={() => setMostrarModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCrear}>
                            <div className="form-group">
                                <label className="form-label">Nombre del proyecto <span className="required">*</span></label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={form.nombre}
                                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                                    placeholder="Ej: Atribuciones SEC 2025"
                                    required
                                    id="input-nombre-proyecto"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Dependencia <span className="required">*</span></label>
                                <select
                                    className="form-control"
                                    value={form.dependencia_id}
                                    onChange={e => setForm({ ...form, dependencia_id: e.target.value })}
                                    required
                                    id="select-dependencia-proyecto"
                                >
                                    <option value="">-- Seleccione --</option>
                                    {dependencias.map(d => (
                                        <option key={d.id} value={d.id}>{d.nombre} ({d.siglas || d.tipo})</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                                <button type="button" className="btn btn-outline" onClick={() => setMostrarModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={guardando} id="btn-guardar-proyecto">
                                    {guardando ? '⏳ Guardando...' : '✅ Crear proyecto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
