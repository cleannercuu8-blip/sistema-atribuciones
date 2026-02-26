import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
    const { usuario } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [innovations, setInnovations] = useState({ workload: [], activity: [] });
    const [proyectos, setProyectos] = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const cargarDatos = async () => {
            try {
                const [resProjs, resInnov] = await Promise.all([
                    api.get('/proyectos'),
                    api.get('/dashboard/innovations')
                ]);

                const projs = resProjs.data;
                setProyectos(projs.slice(0, 5));
                setStats({
                    total: projs.length,
                    borrador: projs.filter(p => p.estado === 'borrador').length,
                    en_revision: projs.filter(p => p.estado === 'en_revision').length,
                    aprobado: projs.filter(p => p.estado === 'aprobado').length,
                });

                setInnovations(resInnov.data);
            } catch (err) {
                console.error("Error al cargar dashboard:", err);
            }
            setCargando(false);
        };
        cargarDatos();
    }, []);

    if (cargando) return <div className="loading-container"><div className="spinner" /><p>Cargando Dashboard...</p></div>;

    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

    // Calcular máximo para el balance de responsabilidades
    const maxWorkload = innovations.workload.length > 0 ? Math.max(...innovations.workload.map(w => w.total)) : 10;

    return (
        <div className="dashboard-container">
            {/* Saludo */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--color-primario)', letterSpacing: '-0.5px' }}>
                    {saludo}, {usuario?.nombre?.split(' ')[0]} <span style={{ fontSize: 24 }}>👋</span>
                </h1>
                <p style={{ color: 'var(--color-texto-suave)', marginTop: 4, fontSize: 15 }}>
                    Esta es la visión general de la institución para el Arbol de Atribuciones.
                </p>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="stats-grid" style={{ marginBottom: 32 }}>
                    <div className="stat-card" style={{ borderBottom: '4px solid #3b82f6' }}>
                        <div className="stat-icon" style={{ background: '#dbeafe', color: '#1e40af' }}>📁</div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.total}</div>
                            <div className="stat-label">Total Gestión</div>
                        </div>
                    </div>
                    <div className="stat-card" style={{ borderBottom: '4px solid #f59e0b' }}>
                        <div className="stat-icon" style={{ background: '#fef3c7', color: '#92400e' }}>✏️</div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.borrador}</div>
                            <div className="stat-label">En Redacción</div>
                        </div>
                    </div>
                    <div className="stat-card" style={{ borderBottom: '4px solid #eab308' }}>
                        <div className="stat-icon" style={{ background: '#fef9c3', color: '#854d0e' }}>🔍</div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.en_revision}</div>
                            <div className="stat-label">En Revisión</div>
                        </div>
                    </div>
                    <div className="stat-card" style={{ borderBottom: '4px solid #10b981' }}>
                        <div className="stat-icon" style={{ background: '#d1fae5', color: '#065f46' }}>✅</div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.aprobado}</div>
                            <div className="stat-label">Validados</div>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
                {/* Proyectos recientes */}
                <div className="card" style={{ margin: 0 }}>
                    <div className="card-header" style={{ borderBottom: '1px solid #f1f5f9', padding: '16px 20px' }}>
                        <span className="card-title" style={{ fontSize: 16, fontWeight: 800 }}>📁 Proyectos Recientes</span>
                        <button className="btn btn-primary btn-sm" onClick={() => navigate('/proyectos')} style={{ borderRadius: 8 }}>
                            Ver Todos
                        </button>
                    </div>
                    {proyectos.length === 0 ? (
                        <div className="empty-state" style={{ padding: 40 }}>
                            <div className="empty-icon" style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                            <h3>Sin actividad</h3>
                            <p>Los proyectos aparecerán aquí conforme se creen.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', background: '#f8fafc' }}>
                                        <th style={{ padding: '12px 20px', fontSize: 12, color: '#64748b' }}>PROYECTO</th>
                                        <th style={{ padding: '12px 20px', fontSize: 12, color: '#64748b' }}>DEPENDENCIA</th>
                                        <th style={{ padding: '12px 20px', fontSize: 12, color: '#64748b' }}>ESTADO</th>
                                        <th style={{ padding: '12px 20px', fontSize: 12, color: '#64748b', textAlign: 'right' }}>ACCIONES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {proyectos.map(p => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '16px 20px' }}><strong>{p.nombre}</strong></td>
                                            <td style={{ padding: '16px 20px', color: '#64748b', fontSize: 13 }}>{p.dependencia_nombre}</td>
                                            <td style={{ padding: '16px 20px' }}>
                                                <span className={`badge badge-${p.estado}`} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6 }}>
                                                    {p.estado === 'borrador' ? '✏️ Redacción'
                                                        : p.estado === 'en_revision' ? '🔍 En revisión'
                                                            : '✅ Aprobado'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                <button className="btn btn-outline btn-sm" onClick={() => navigate(`/proyectos/${p.id}`)} style={{ borderRadius: 6 }}>
                                                    Abrir
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Balance de Responsabilidades */}
                <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
                    <div className="card-header" style={{ borderBottom: '1px solid #f1f5f9', padding: '16px 20px' }}>
                        <span className="card-title" style={{ fontSize: 16, fontWeight: 800 }}>⚖️ Balance de Responsables</span>
                    </div>
                    <div style={{ padding: '20px', flex: 1 }}>
                        {innovations.workload.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 40 }}>Pendiente de asignación</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {innovations.workload.map((w, idx) => {
                                    const percent = (w.total / maxWorkload) * 100;
                                    return (
                                        <div key={idx}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                                                <span style={{ fontWeight: 600, color: '#334155' }}>{w.responsable}</span>
                                                <span style={{ fontWeight: 800, color: 'var(--color-primario)' }}>{w.total} proy.</span>
                                            </div>
                                            <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${percent}%`,
                                                    background: 'linear-gradient(90deg, #1a3a5c, #3b82f6)',
                                                    borderRadius: 4,
                                                    transition: 'width 1s ease-out'
                                                }}></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Feed de Actividad Reciente */}
            <div className="card" style={{ margin: 0 }}>
                <div className="card-header" style={{ borderBottom: '1px solid #f1f5f9', padding: '16px 20px', background: 'linear-gradient(to right, #f8fafc, #ffffff)' }}>
                    <span className="card-title" style={{ fontSize: 16, fontWeight: 800 }}>🔔 Feed de Validaciones y Actividad</span>
                </div>
                <div style={{ padding: 0 }}>
                    {innovations.activity.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                            <p>No se han registrado movimientos recientes en el sistema.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 1, background: '#f1f5f9' }}>
                            {innovations.activity.map((a, idx) => {
                                const config = {
                                    creacion: { icon: '✨', label: 'Creación', color: '#0ea5e9', bg: '#f0f9ff' },
                                    actualizacion: { icon: '📝', label: 'Actualización', color: '#f59e0b', bg: '#fffbeb' },
                                    eliminacion: { icon: '🗑️', label: 'Eliminación', color: '#ef4444', bg: '#fef2f2' },
                                    observacion: { icon: '💬', label: 'Observación', color: '#e11d48', bg: '#fff1f2' },
                                    estado: { icon: '📌', label: 'Cambio de Estado', color: '#10b981', bg: '#f0fdf4' }
                                }[a.tipo] || { icon: '🔔', label: 'Actividad', color: '#64748b', bg: '#f8fafc' };

                                return (
                                    <div key={idx} style={{ background: '#fff', padding: '20px', display: 'flex', gap: 16 }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 12,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: config.bg,
                                            color: config.color,
                                            fontSize: 20
                                        }}>
                                            {config.icon}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: config.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                    {config.label}
                                                </span>
                                                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                                    {new Date(a.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: 14, color: '#334155', marginBottom: 8, lineHeight: 1.4 }}>
                                                {a.mensaje}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {a.proyecto_nombre && (
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1a3a5c' }}>📄 {a.proyecto_nombre}</span>
                                                )}
                                                {a.proyecto_nombre && <span style={{ fontSize: 12, color: '#94a3b8' }}>•</span>}
                                                <span style={{ fontSize: 12, color: '#64748b' }}>👤 {a.autor}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
