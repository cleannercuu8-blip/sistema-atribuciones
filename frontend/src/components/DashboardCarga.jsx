import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const DashboardCarga = ({ proyectoId }) => {
    const [stats, setStats] = useState([]);
    const [cargando, setCargando] = useState(true);

    const cargarCarga = async () => {
        try {
            const res = await api.get(`/proyectos/${proyectoId}/atribuciones-especificas`);
            const atribs = res.data;

            // Procesar carga por usuario
            const mapa = {};
            atribs.forEach(a => {
                if (a.responsable_id) {
                    if (!mapa[a.responsable_id]) mapa[a.responsable_id] = { nombre: a.responsable_nombre, principal: 0, apoyo: 0 };
                    mapa[a.responsable_id].principal++;
                }
                if (a.apoyo_ids) {
                    a.apoyo_ids.forEach((id, idx) => {
                        const nombre = a.apoyo_nombres?.[idx] || 'Usuario';
                        if (!mapa[id]) mapa[id] = { nombre, principal: 0, apoyo: 0 };
                        mapa[id].apoyo++;
                    });
                }
            });
            setStats(Object.values(mapa).sort((a, b) => (b.principal + b.apoyo) - (a.principal + a.apoyo)));
        } catch { }
        setCargando(false);
    };

    useEffect(() => { cargarCarga(); }, [proyectoId]);

    if (cargando) return <div className="loading-container"><div className="spinner" /></div>;

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-primario)', marginBottom: '8px' }}>📊 Carga de Trabajo</h2>
                <p style={{ color: 'var(--color-texto-suave)', fontSize: '14px' }}>Distribución de responsabilidades por integrante del equipo.</p>
            </div>

            <div className="stats-grid">
                {stats.length === 0 ? (
                    <div className="empty-state card"><h3>Sin datos</h3><p>No hay responsables asignados aún.</p></div>
                ) : (
                    stats.map((u, i) => {
                        const total = u.principal + u.apoyo;
                        const maxTotal = stats[0].principal + stats[0].apoyo;
                        const porc = (total / maxTotal) * 100;

                        return (
                            <div key={i} className="stat-card">
                                <div className="stat-card-top">
                                    <div className="stat-icon-wrapper" style={{ background: i === 0 ? '#fee2e2' : '#f1f5f9', color: i === 0 ? '#991b1b' : '#475569' }}>
                                        {i === 0 ? '🔥' : '👤'}
                                    </div>
                                    <span className="stat-label">Integrante</span>
                                </div>
                                <div>
                                    <div className="stat-value">{total}</div>
                                    <div style={{ fontWeight: '700', color: 'var(--color-primario)', fontSize: '14px', marginTop: '4px' }}>{u.nombre}</div>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--color-texto-suave)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Principal: <strong>{u.principal}</strong></span>
                                    <span>Apoyo: <strong>{u.apoyo}</strong></span>
                                </div>
                                <div className="stat-progress-bg">
                                    <div className="stat-progress-fill" style={{ width: `${porc}%`, background: i === 0 ? 'var(--color-peligro)' : 'var(--color-acento)' }} />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default DashboardCarga;
