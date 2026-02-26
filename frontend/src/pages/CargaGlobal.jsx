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
                            principal: 0,
                            apoyo: 0,
                            proyectos: new Set(),
                            detalle: []
                        };
                    }
                    mapa[rNombre].proyectos.add(p.nombre);
                }
            });

            // 3. Contabilizar atribuciones específicas
            atribs.forEach(a => {
                // Principal
                const pNombre = a.responsable_nombre?.trim();
                if (pNombre) {
                    if (!mapa[pNombre]) {
                        mapa[pNombre] = {
                            nombre: pNombre,
                            principal: 0,
                            apoyo: 0,
                            proyectos: new Set(),
                            detalle: []
                        };
                    }
                    mapa[pNombre].principal++;
                    mapa[pNombre].proyectos.add(a.proyecto_nombre);
                    mapa[pNombre].detalle.push({
                        proyecto: a.proyecto_nombre,
                        unidad: a.unidad_siglas,
                        clave: a.clave,
                        rol: 'Principal'
                    });
                }

                // Apoyo
                if (a.apoyo_ids) {
                    a.apoyo_ids.forEach((id, idx) => {
                        const sNombre = a.apoyo_nombres?.[idx]?.trim();
                        if (sNombre) {
                            if (!mapa[sNombre]) {
                                mapa[sNombre] = {
                                    nombre: sNombre,
                                    principal: 0,
                                    apoyo: 0,
                                    proyectos: new Set(),
                                    detalle: []
                                };
                            }
                            mapa[sNombre].apoyo++;
                            mapa[sNombre].proyectos.add(a.proyecto_nombre);
                            mapa[sNombre].detalle.push({
                                proyecto: a.proyecto_nombre,
                                unidad: a.unidad_siglas,
                                clave: a.clave,
                                rol: 'Apoyo'
                            });
                        }
                    });
                }
            });

            const resultado = Object.values(mapa).map(u => ({
                ...u,
                proyectosCount: u.proyectos.size,
                total: u.principal + u.apoyo
            })).sort((a, b) => b.total - a.total);

            setStats(resultado);
        } catch (err) {
            console.error(err);
        }
        setCargando(false);
    };

    useEffect(() => { cargarDatos(); }, []);

    const filtrados = stats.filter(u => u.nombre.toLowerCase().includes(filtro.toLowerCase()));

    if (cargando) return <div className="loading-container"><div className="spinner" /></div>;

    return (
        <div style={{ padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primario)', marginBottom: '8px' }}>⚖️ Carga de Trabajo Global</h1>
                    <p style={{ color: 'var(--color-texto-suave)', fontSize: '15px' }}>Balance de responsabilidades consolidado de todos los proyectos activos.</p>
                </div>
                <div style={{ width: '300px' }}>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="🔍 Buscar por nombre..."
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
                        const maxTotal = stats[0]?.total || 1;
                        const porc = (u.total / maxTotal) * 100;

                        return (
                            <div key={i} className="stat-card" style={{ borderLeft: `5px solid ${i === 0 ? 'var(--color-peligro)' : 'var(--color-primario)'}` }}>
                                <div className="stat-card-top">
                                    <div className="stat-icon-wrapper" style={{ background: i === 0 ? '#fee2e2' : '#f1f5f9', color: i === 0 ? '#991b1b' : '#475569' }}>
                                        {i === 0 ? '🔥' : '👤'}
                                    </div>
                                    <span className="stat-label">{u.proyectosCount} Proyectos</span>
                                </div>

                                <div style={{ margin: '15px 0' }}>
                                    <div style={{ fontWeight: '800', color: 'var(--color-primario)', fontSize: '18px', marginBottom: '5px' }}>{u.nombre}</div>
                                    <div className="stat-value" style={{ fontSize: '42px' }}>{u.total}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--color-texto-suave)', fontWeight: '600' }}>ATRIBUCIONES TOTALES</div>
                                </div>

                                <div style={{ display: 'flex', gap: '15px', padding: '10px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', marginBottom: '15px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '11px', color: 'var(--color-texto-suave)', textTransform: 'uppercase' }}>Principal</div>
                                        <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-texto)' }}>{u.principal}</div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '11px', color: 'var(--color-texto-suave)', textTransform: 'uppercase' }}>Apoyo</div>
                                        <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-texto)' }}>{u.apoyo}</div>
                                    </div>
                                </div>

                                <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '15px', paddingRight: '5px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-texto-suave)', marginBottom: '8px', textTransform: 'uppercase' }}>Desglose por Proyecto</div>
                                    {Array.from(u.proyectos).map((p, pi) => (
                                        <div key={pi} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px dashed #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontWeight: '500' }}>{p}</span>
                                            <span className="badge badge-info" style={{ fontSize: '10px' }}>{u.detalle.filter(d => d.proyecto === p).length}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="stat-progress-bg" style={{ height: '8px' }}>
                                    <div className="stat-progress-fill" style={{
                                        width: `${porc}%`,
                                        background: i === 0 ? 'var(--color-peligro)' : 'var(--color-acento)',
                                        borderRadius: '4px'
                                    }} />
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
