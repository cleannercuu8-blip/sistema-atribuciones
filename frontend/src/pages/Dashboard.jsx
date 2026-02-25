import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
    const { usuario } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [proyectos, setProyectos] = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const cargarDatos = async () => {
            try {
                const res = await api.get('/proyectos');
                const projs = res.data;
                setProyectos(projs.slice(0, 5));
                setStats({
                    total: projs.length,
                    borrador: projs.filter(p => p.estado === 'borrador').length,
                    en_revision: projs.filter(p => p.estado === 'en_revision').length,
                    aprobado: projs.filter(p => p.estado === 'aprobado').length,
                });
            } catch { }
            setCargando(false);
        };
        cargarDatos();
    }, []);

    if (cargando) return <div className="loading-container"><div className="spinner" /><p>Cargando...</p></div>;

    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

    return (
        <div>
            {/* Saludo */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-primario)' }}>
                    {saludo}, {usuario?.nombre?.split(' ')[0]} 👋
                </h1>
                <p style={{ color: 'var(--color-texto-suave)', marginTop: 4 }}>
                    Bienvenido al Sistema de Atribuciones Jerárquicas
                </p>
            </div>

            {/* Stats */}
            {stats && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: '#dbeafe' }}>📁</div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.total}</div>
                            <div className="stat-label">Total proyectos</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: '#fef3c7' }}>✏️</div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.borrador}</div>
                            <div className="stat-label">En borrador</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: '#fde68a' }}>🔍</div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.en_revision}</div>
                            <div className="stat-label">En revisión</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: '#d1fae5' }}>✅</div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.aprobado}</div>
                            <div className="stat-label">Aprobados</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Proyectos recientes */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">📁 Proyectos recientes</span>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/proyectos')}>
                        Ver todos
                    </button>
                </div>
                {proyectos.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        <h3>No hay proyectos aún</h3>
                        <p>Los proyectos de atribuciones aparecerán aquí</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Proyecto</th>
                                    <th>Dependencia</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {proyectos.map(p => (
                                    <tr key={p.id}>
                                        <td><strong>{p.nombre}</strong></td>
                                        <td>{p.dependencia_nombre}</td>
                                        <td>
                                            <span className={`badge badge-${p.estado}`}>
                                                {p.estado === 'borrador' ? '✏️ Borrador'
                                                    : p.estado === 'en_revision' ? '🔍 En revisión'
                                                        : '✅ Aprobado'}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/proyectos/${p.id}`)}>
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

            {/* Info de acceso rápido */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                <div className="card" style={{ borderLeft: '4px solid var(--color-acento)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--color-primario)' }}>🌳 Árbol de atribuciones</h3>
                    <p style={{ fontSize: 13, color: 'var(--color-texto-suave)', marginBottom: 16 }}>
                        Capture y relacione las atribuciones desde la Ley hasta el último nivel de la unidad administrativa.
                    </p>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/proyectos')}>
                        Ir a proyectos
                    </button>
                </div>
                {(usuario?.rol === 'admin' || usuario?.rol === 'revisor') && (
                    <div className="card" style={{ borderLeft: '4px solid var(--color-advertencia)' }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--color-primario)' }}>🔍 Revisiones activas</h3>
                        <p style={{ fontSize: 13, color: 'var(--color-texto-suave)', marginBottom: 16 }}>
                            Emita observaciones, asigne plazos y realice el seguimiento de las subsanaciones.
                        </p>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate('/revisiones')}>
                            Ver revisiones
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
