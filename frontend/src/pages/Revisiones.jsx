import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function Revisiones() {
    const [proyectos, setProyectos] = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const cargar = async () => {
            try {
                const res = await api.get('/proyectos');
                // Mostrar solo los que están en revisión
                setProyectos(res.data.filter(p => p.estado === 'en_revision' || true));
            } catch { }
            setCargando(false);
        };
        cargar();
    }, []);

    if (cargando) return <div className="loading-container"><div className="spinner" /></div>;

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primario)' }}>🔍 Panel de Revisiones</h1>
                <p style={{ color: 'var(--color-texto-suave)', marginTop: 4 }}>Proyectos con revisiones activas</p>
            </div>

            {proyectos.filter(p => p.estado === 'en_revision').length === 0 ? (
                <div className="empty-state card">
                    <div className="empty-icon">✅</div>
                    <h3>No hay revisiones activas</h3>
                    <p>Todos los proyectos están al día</p>
                </div>
            ) : (
                <div>
                    {proyectos.filter(p => p.estado === 'en_revision').map(p => (
                        <div key={p.id} className="card" style={{ borderLeft: '4px solid var(--color-advertencia)', marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{p.nombre}</h3>
                                    <p style={{ fontSize: 13, color: 'var(--color-texto-suave)' }}>🏢 {p.dependencia_nombre}</p>
                                </div>
                                <a className="btn btn-primary btn-sm" href={`/proyectos/${p.id}`}>Ir al proyecto →</a>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header">
                    <span className="card-title">📋 Todos los proyectos</span>
                </div>
                <div className="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Proyecto</th>
                                <th>Dependencia</th>
                                <th>Estado</th>
                                <th>Creado</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {proyectos.map(p => (
                                <tr key={p.id}>
                                    <td><strong>{p.nombre}</strong></td>
                                    <td>{p.dependencia_nombre}</td>
                                    <td>
                                        <span className={`badge badge-${p.estado}`}>
                                            {p.estado === 'borrador' ? '✏️ Borrador' : p.estado === 'en_revision' ? '🔍 En revisión' : '✅ Aprobado'}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--color-texto-suave)' }}>{new Date(p.created_at).toLocaleDateString('es-MX')}</td>
                                    <td><a className="btn btn-outline btn-sm" href={`/proyectos/${p.id}`}>Abrir</a></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
