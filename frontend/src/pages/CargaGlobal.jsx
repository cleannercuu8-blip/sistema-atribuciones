import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const CargaGlobal = () => {
    const [stats, setStats] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [filtro, setFiltro] = useState('');
    const navigate = useNavigate();

    const cargarDatos = async () => {
        try {
            const [respRes, proyRes] = await Promise.all([
                api.get('/catalogos/responsables').catch(() => ({ data: [] })),
                api.get('/proyectos').catch(() => ({ data: [] }))
            ]);

            const catResponsables = respRes.data || [];
            const proyectos = proyRes.data || [];

            const mapa = {};

            catResponsables.forEach(r => {
                const nombre = r.nombre?.trim();
                if (!nombre) return;
                mapa[nombre] = { nombre, proyectos: [] };
            });

            proyectos.forEach(p => {
                const rNombre = p.responsable?.trim();
                if (rNombre) {
                    if (!mapa[rNombre]) mapa[rNombre] = { nombre: rNombre, proyectos: [] };
                    mapa[rNombre].proyectos.push({
                        id: p.id,
                        nombre: p.nombre,
                        estado: p.estado_nombre || 'Sin estado',
                        color: p.estado_color || '#475569',
                        dependencia: p.dependencia_nombre || ''
                    });
                }
            });

            setStats(Object.values(mapa).sort((a, b) => b.proyectos.length - a.proyectos.length));
        } catch (err) {
            console.error(err);
        }
        setCargando(false);
    };

    useEffect(() => { cargarDatos(); }, []);

    const filtrados = stats.filter(u => u.nombre.toLowerCase().includes(filtro.toLowerCase()));
    const totalProyectos = stats.reduce((acc, u) => acc + u.proyectos.length, 0);
    const conProyectos = stats.filter(u => u.proyectos.length > 0).length;

    if (cargando) return <div className="loading-container"><div className="spinner" /></div>;

    return (
        <div style={{ padding: '24px' }}>
            {/* Header compacto */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--color-primario)', margin: 0 }}>
                            ⚖️ Carga de Trabajo Global
                        </h1>
                        <p style={{ color: 'var(--color-texto-suave)', fontSize: '13px', margin: '4px 0 0' }}>
                            Proyectos activos por responsable de revisión
                        </p>
                    </div>
                    {/* Métricas rápidas */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{
                            background: 'var(--color-primario)',
                            color: '#fff',
                            padding: '8px 16px',
                            borderRadius: '10px',
                            textAlign: 'center',
                            minWidth: 80
                        }}>
                            <div style={{ fontSize: '22px', fontWeight: '800', lineHeight: 1 }}>{totalProyectos}</div>
                            <div style={{ fontSize: '10px', opacity: 0.85, marginTop: 2 }}>Proyectos</div>
                        </div>
                        <div style={{
                            background: '#f0fdf4',
                            color: '#16a34a',
                            border: '1px solid #bbf7d0',
                            padding: '8px 16px',
                            borderRadius: '10px',
                            textAlign: 'center',
                            minWidth: 80
                        }}>
                            <div style={{ fontSize: '22px', fontWeight: '800', lineHeight: 1 }}>{conProyectos}</div>
                            <div style={{ fontSize: '10px', opacity: 0.85, marginTop: 2 }}>Con carga</div>
                        </div>
                        <div style={{
                            background: '#f8fafc',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                            padding: '8px 16px',
                            borderRadius: '10px',
                            textAlign: 'center',
                            minWidth: 80
                        }}>
                            <div style={{ fontSize: '22px', fontWeight: '800', lineHeight: 1 }}>{stats.length}</div>
                            <div style={{ fontSize: '10px', opacity: 0.85, marginTop: 2 }}>Responsables</div>
                        </div>
                    </div>
                </div>

                {/* Buscador */}
                <div style={{ marginTop: 16 }}>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="🔍 Buscar responsable..."
                        value={filtro}
                        onChange={e => setFiltro(e.target.value)}
                        style={{ maxWidth: 340 }}
                    />
                </div>
            </div>

            {/* Lista de responsables */}
            {filtrados.length === 0 ? (
                <div className="empty-state card">
                    <div className="empty-icon">👤</div>
                    <h3>Sin resultados</h3>
                    <p>No se encontraron responsables con esos criterios.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtrados.map((u, i) => (
                        <div key={i} style={{
                            background: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                            transition: 'box-shadow 0.2s'
                        }}>
                            {/* Encabezado de responsable */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                background: u.proyectos.length > 0
                                    ? 'linear-gradient(135deg, var(--color-primario) 0%, #1e40af 100%)'
                                    : '#f8fafc',
                                color: u.proyectos.length > 0 ? '#fff' : '#64748b'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: u.proyectos.length > 0 ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: '800', fontSize: 14,
                                        color: u.proyectos.length > 0 ? '#fff' : 'var(--color-primario)',
                                        flexShrink: 0
                                    }}>
                                        {u.nombre.charAt(0).toUpperCase()}
                                    </div>
                                    <span style={{ fontWeight: '700', fontSize: '14px' }}>{u.nombre}</span>
                                </div>
                                <span style={{
                                    background: u.proyectos.length > 0 ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                                    color: u.proyectos.length > 0 ? '#fff' : '#64748b',
                                    borderRadius: '20px',
                                    padding: '3px 10px',
                                    fontSize: '12px',
                                    fontWeight: '700'
                                }}>
                                    {u.proyectos.length} {u.proyectos.length === 1 ? 'proyecto' : 'proyectos'}
                                </span>
                            </div>

                            {/* Proyectos */}
                            {u.proyectos.length === 0 ? (
                                <div style={{ padding: '10px 16px', color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>
                                    Sin proyectos asignados
                                </div>
                            ) : (
                                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {u.proyectos.map((p, pi) => (
                                        <div
                                            key={pi}
                                            onClick={() => navigate(`/proyectos/${p.id}`)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                background: '#f8fafc',
                                                border: '1px solid #f1f5f9',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s',
                                                gap: 12
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = '#eff6ff';
                                                e.currentTarget.style.borderColor = '#bfdbfe';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = '#f8fafc';
                                                e.currentTarget.style.borderColor = '#f1f5f9';
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    width: 6, height: 6, borderRadius: '50%',
                                                    background: p.color, flexShrink: 0
                                                }} />
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{
                                                        fontWeight: '600', fontSize: '13px',
                                                        color: 'var(--color-primario)',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                    }}>{p.nombre}</div>
                                                    {p.dependencia && (
                                                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: 1 }}>{p.dependencia}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                <span style={{
                                                    fontSize: '11px', fontWeight: '600',
                                                    padding: '2px 8px', borderRadius: '6px',
                                                    background: p.color + '18',
                                                    color: p.color,
                                                    border: `1px solid ${p.color}30`
                                                }}>
                                                    {p.estado}
                                                </span>
                                                <span style={{ color: '#94a3b8', fontSize: '14px' }}>→</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CargaGlobal;
