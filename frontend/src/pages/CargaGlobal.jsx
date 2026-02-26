import React, { useEffect, useState } from 'react';
import api from '../services/api';

const CargaGlobal = () => {
    const [stats, setStats] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [filtro, setFiltro] = useState('');

    const cargarDatos = async () => {
        try {
            // Usamos Promise.allSettled o manejamos errores individuales para que un fallo no bloquee todo
            const [atribsRes, respRes, proyRes] = await Promise.all([
                api.get('/atribuciones-generales/especificas/todas').catch(e => ({ data: [] })),
                api.get('/catalogos/responsables').catch(e => ({ data: [] })),
                api.get('/proyectos').catch(e => ({ data: [] }))
            ]);

            const atribs = atribsRes.data || [];
            const catResponsables = respRes.data || [];
            const proyectos = proyRes.data || [];

            const mapa = {};

            // 1. Inicializar con todos los responsables del catálogo
            catResponsables.forEach(r => {
                const nombre = r.nombre?.trim();
                if (!nombre) return;
                mapa[nombre] = {
                    nombre: nombre,
                    principal: 0,
                    apoyo: 0,
                    proyectos: new Set(),
                    detalle: []
                };
            });

            // 2. Agregar información de los proyectos por responsable
            proyectos.forEach(p => {
                const rNombre = p.responsable?.trim();
                if (rNombre) {
                    if (!mapa[rNombre]) {
                        mapa[rNombre] = {
                            nombre: rNombre,
                            proyectos: [],
                        };
                    }
                    mapa[rNombre].proyectos.push({
                        id: p.id,
                        nombre: p.nombre,
                        estado: p.estado_nombre || 'N/A',
                        color: p.estado_color || '#475569'
                    });
                }
            });

            const resultado = Object.values(mapa).sort((a, b) => b.proyectos.length - a.proyectos.length);
            setStats(resultado);
        } catch (err) {
            console.error(err);
        }
        setCargando(false);
    };

    useEffect(() => { cargarDatos(); }, []);

    const navigate = useNavigate();
    const filtrados = stats.filter(u => u.nombre.toLowerCase().includes(filtro.toLowerCase()));

    if (cargando) return <div className="loading-container"><div className="spinner" /></div>;

    return (
        <div style={{ padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primario)', marginBottom: '8px' }}>⚖️ Carga de Trabajo Global</h1>
                    <p style={{ color: 'var(--color-texto-suave)', fontSize: '15px' }}>Proyectos asignados a cada responsable de revisión.</p>
                </div>
                <div style={{ width: '300px' }}>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="🔍 Buscar responsable..."
                        value={filtro}
                        onChange={e => setFiltro(e.target.value)}
                    />
                </div>
            </div>

            <div className="stats-grid">
                {filtrados.length === 0 ? (
                    <div className="empty-state card" style={{ gridColumn: '1 / -1' }}>
                        <div className="empty-icon">⚖️</div>
                        <h3>Sin resultados</h3>
                        <p>No se encontraron responsables con esos criterios.</p>
                    </div>
                ) : (
                    filtrados.map((u, i) => {
                        return (
                            <div key={i} className="stat-card" style={{ borderLeft: `5px solid var(--color-primario)` }}>
                                <div className="stat-card-top">
                                    <div className="stat-icon-wrapper">👤</div>
                                    <span className="stat-label">{u.proyectos.length} Proyectos</span>
                                </div>

                                <div style={{ margin: '15px 0' }}>
                                    <div style={{ fontWeight: '800', color: 'var(--color-primario)', fontSize: '20px', marginBottom: '15px' }}>{u.nombre}</div>
                                </div>

                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-texto-suave)', marginBottom: '12px', textTransform: 'uppercase' }}>Proyectos a su cargo</div>
                                    {u.proyectos.length === 0 ? (
                                        <p style={{ fontSize: '13px', color: '#999', fontStyle: 'italic' }}>Sin proyectos asignados</p>
                                    ) : (
                                        u.proyectos.map((p, pi) => (
                                            <div
                                                key={pi}
                                                onClick={() => navigate(`/proyectos/${p.id}`)}
                                                className="project-link-item"
                                                style={{
                                                    fontSize: '14px',
                                                    padding: '10px',
                                                    marginBottom: '8px',
                                                    borderRadius: '8px',
                                                    background: '#f8fafc',
                                                    border: '1px solid #f1f5f9',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <span style={{ fontWeight: '600', color: 'var(--color-primario)' }}>{p.nombre}</span>
                                                <span
                                                    className="badge"
                                                    style={{
                                                        fontSize: '10px',
                                                        background: p.color + '20',
                                                        color: p.color,
                                                        border: `1px solid ${p.color}40`
                                                    }}
                                                >
                                                    {p.estado}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default CargaGlobal;
