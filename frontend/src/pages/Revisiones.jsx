import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// ── Config visual por tipo de cambio ──────────────────────────────────────────
const TIPO_CONFIG = {
    atribucion_especifica: { icono: '🔵', etiqueta: 'Atribución Específica', color: '#eff6ff', colorBorde: '#93c5fd', colorHeader: '#1d4ed8' },
    glosario: { icono: '📖', etiqueta: 'Glosario', color: '#f0fdf4', colorBorde: '#6ee7b7', colorHeader: '#15803d' },
    atribucion_general: { icono: '📜', etiqueta: 'Atrib. General (Ley)', color: '#faf5ff', colorBorde: '#c084fc', colorHeader: '#7e22ce' },
    corresponsabilidad: { icono: '🔗', etiqueta: 'Corresponsabilidad', color: '#fff7ed', colorBorde: '#fdba74', colorHeader: '#c2410c' },
};

// ── Tarjeta individual de cambio ──────────────────────────────────────────────
function TarjetaCambio({ c, onToggle }) {
    const cfg = TIPO_CONFIG[c.tipo] || TIPO_CONFIG['atribucion_especifica'];
    const esCorrsp = c.tipo === 'corresponsabilidad';
    const esGlosario = c.tipo === 'glosario';
    const esAG = c.tipo === 'atribucion_general';

    return (
        <div style={{
            border: c._aceptado ? `1.5px solid #86efac` : `1.5px dashed #fca5a5`,
            borderRadius: 10, padding: 16,
            background: c._aceptado ? cfg.color : '#fff8f8',
            opacity: c._aceptado ? 1 : 0.65,
            transition: 'all 0.2s ease',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ background: cfg.color, color: cfg.colorHeader, border: `1px solid ${cfg.colorBorde}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>
                        {cfg.icono} {cfg.etiqueta}
                    </span>
                    {esCorrsp && (
                        <span style={{ background: '#fef9c3', color: '#92400e', border: '1px solid #fde047', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                            ⚠️ Cambia jerarquía
                        </span>
                    )}
                    <span style={{ fontSize: 12, color: '#64748b' }}>Cambio #{c._idx + 1} · ID: {c.id} · {c.hoja}</span>
                </div>
                <button onClick={() => onToggle(c._idx)} style={{
                    padding: '5px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: 13, minWidth: 130, color: 'white', transition: 'background 0.2s',
                    background: c._aceptado ? '#16a34a' : '#dc2626',
                }} title={c._aceptado ? 'Clic para rechazar' : 'Clic para aceptar'}>
                    {c._aceptado ? '✅ Aceptado' : '❌ Rechazado'}
                </button>
            </div>

            {c.observacion ? (
                <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', marginBottom: 4 }}>📝 Observación del Revisor</div>
                    <p style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5, margin: 0 }}>{c.observacion}</p>
                </div>
            ) : (
                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '8px 14px', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Sin observación capturada en el Excel</span>
                </div>
            )}

            {esCorrsp ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', marginBottom: 6 }}>🔴 Relación actual</div>
                        <p style={{ fontSize: 13, color: '#7f1d1d', margin: 0 }}>Clave: <strong>{c.clave_actual || '(sin asignación)'}</strong></p>
                    </div>
                    <div style={{ background: '#fff7ed', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', marginBottom: 6 }}>🟠 Nueva relación</div>
                        <p style={{ fontSize: 13, color: '#7c2d12', margin: 0 }}>Clave: <strong>{c.clave_propuesta || '(sin asignación)'}</strong></p>
                        <p style={{ fontSize: 11, color: '#9a3412', marginTop: 6, marginBottom: 0, fontStyle: 'italic' }}>Se actualizará el vínculo hasta la Ley automáticamente.</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', marginBottom: 6 }}>
                            🔴 {esGlosario ? 'Significado actual' : esAG ? 'Texto actual (Ley)' : 'Texto actual'}
                        </div>
                        <del style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.6 }}>{c.texto_original || '(vacío)'}</del>
                    </div>
                    <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#166534', textTransform: 'uppercase', marginBottom: 6 }}>
                            🟢 {esGlosario ? 'Nuevo significado' : esAG ? 'Nuevo texto (Ley)' : 'Propuesta'}
                        </div>
                        <p style={{ fontSize: 13, color: '#14532d', lineHeight: 1.6, margin: 0 }}>{c.texto_propuesto}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Historial de versiones Excel ──────────────────────────────────────────────
function HistorialVersiones({ proyectoId, handleEliminarHistorial, handleEditarHistorial }) {
    const [historial, setHistorial] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [expandido, setExpandido] = useState(null);

    useEffect(() => {
        if (!proyectoId) return;
        setCargando(true);
        api.get(`/proyectos/${proyectoId}/revision-excel/historial`)
            .then(r => setHistorial(r.data))
            .catch(() => setHistorial([]))
            .finally(() => setCargando(false));
    }, [proyectoId]);

    if (cargando) return <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>⏳ Cargando historial...</div>;
    if (historial.length === 0) return (
        <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: 14 }}>
            📂 Aún no se han subido Excels de revisión para este proyecto.
        </div>
    );

    return (
        <div>
            <div className="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Fecha</th>
                            <th>Archivo</th>
                            <th>Detectados</th>
                            <th>Aplicados</th>
                            <th>Usuario</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {historial.map((h, i) => (
                            <React.Fragment key={h.id}>
                                <tr>
                                    <td style={{ color: '#64748b', fontSize: 12 }}>{historial.length - i}</td>
                                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                        {new Date(h.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                                    </td>
                                    <td style={{ maxWidth: 200, fontSize: 13 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span
                                                title={h.nombre_archivo}
                                                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                            >
                                                📄 {h.nombre_archivo || 'archivo.xlsx'}
                                            </span>
                                            {usuario?.rol !== 'enlace' && (
                                                <button
                                                    className="btn btn-ghost btn-xs"
                                                    onClick={() => handleEditarHistorial(h)}
                                                    style={{ padding: '0 4px', fontSize: 10 }}
                                                    title="Renombrar esta versión"
                                                >
                                                    ✏️
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{ background: '#e2e8f0', color: '#475569', borderRadius: 12, padding: '2px 10px', fontWeight: 700, fontSize: 12 }}>{h.total_cambios}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 12, padding: '2px 10px', fontWeight: 700, fontSize: 12 }}>{h.cambios_aplicados}</span>
                                    </td>
                                    <td style={{ fontSize: 12, color: '#475569' }}>{h.usuario_nombre || '-'}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        {h.archivo_url && (
                                            <a
                                                href={`${api.defaults.baseURL.replace('/api', '')}/uploads/revisiones/${h.archivo_url}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-outline btn-sm"
                                                style={{ fontSize: 11, marginRight: 6, color: '#1d4ed8', borderColor: '#bfdbfe' }}
                                                title="Descargar el Excel original subpuesto"
                                            >
                                                📥 Excel
                                            </a>
                                        )}
                                        <button
                                            className="btn btn-outline btn-sm"
                                            onClick={() => setExpandido(expandido === h.id ? null : h.id)}
                                            style={{ fontSize: 11 }}
                                        >
                                            {expandido === h.id ? '▲ Ocultar' : '👁 Ver resumen'}
                                        </button>
                                        {usuario?.rol !== 'enlace' && (
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => handleEliminarHistorial(h.id)}
                                                style={{ fontSize: 11, color: '#ef4444', marginLeft: 6 }}
                                                title="Eliminar este registro del historial"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                {expandido === h.id && (
                                    <tr>
                                        <td colSpan={7} style={{ padding: '0 16px 16px', background: '#f8fafc' }}>
                                            <div style={{ paddingTop: 12 }}>
                                                <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase' }}>
                                                    Resumen de cambios — {new Date(h.created_at).toLocaleString('es-MX')}
                                                </p>
                                                {!h.resumen_cambios || h.resumen_cambios.length === 0 ? (
                                                    <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>Sin detalle disponible.</p>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        {h.resumen_cambios.map((c, ci) => {
                                                            const cfg = TIPO_CONFIG[c.tipo] || TIPO_CONFIG['atribucion_especifica'];
                                                            return (
                                                                <div key={ci} style={{
                                                                    background: cfg.color,
                                                                    border: `1px solid ${cfg.colorBorde}`,
                                                                    borderRadius: 8, padding: '8px 14px',
                                                                    display: 'flex', gap: 10, alignItems: 'flex-start',
                                                                }}>
                                                                    <span style={{ fontSize: 16, flexShrink: 0 }}>{cfg.icono}</span>
                                                                    <div>
                                                                        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.colorHeader, textTransform: 'uppercase' }}>
                                                                            {cfg.etiqueta} · ID {c.id}
                                                                        </span>
                                                                        {c.observacion && (
                                                                            <p style={{ fontSize: 12, color: '#78350f', background: '#fef9c3', borderRadius: 4, padding: '3px 8px', margin: '4px 0 0', display: 'inline-block' }}>
                                                                                📝 {c.observacion}
                                                                            </p>
                                                                        )}
                                                                        {c.tipo === 'corresponsabilidad' ? (
                                                                            <p style={{ fontSize: 12, color: '#374151', margin: '4px 0 0' }}>
                                                                                {c.clave_actual || '(vacío)'} → <strong>{c.clave_propuesta || '(vacío)'}</strong>
                                                                            </p>
                                                                        ) : (
                                                                            <p style={{ fontSize: 12, color: '#374151', margin: '4px 0 0' }}>
                                                                                <span style={{ textDecoration: 'line-through', color: '#9ca3af' }}>
                                                                                    {(c.texto_original || '').substring(0, 80)}
                                                                                </span>
                                                                                {' → '}
                                                                                <strong>{(c.texto_propuesto || '').substring(0, 80)}</strong>
                                                                                {(c.texto_propuesto || '').length > 80 ? '...' : ''}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function Revisiones() {
    const { usuario } = useAuth();
    const [proyectos, setProyectos] = useState([]);
    const [proyectoId, setProyectoId] = useState('');
    const [proyectoActual, setProyectoActual] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [cargandoProyectos, setCargandoProyectos] = useState(true);

    // Estado del flujo Excel
    const [cambiosDetectados, setCambiosDetectados] = useState([]);
    const [archivoSubido, setArchivoSubido] = useState(null);
    const [archivoUrlTemporal, setArchivoUrlTemporal] = useState(null);

    // Estado del historial rápido para el Paso 1
    const [ultimoHistorial, setUltimoHistorial] = useState(null);

    // Cargar lista de proyectos
    useEffect(() => {
        api.get('/proyectos')
            .then(r => setProyectos(r.data))
            .catch(() => { })
            .finally(() => setCargandoProyectos(false));
    }, []);

    const [refreshHistorial, setRefreshHistorial] = useState(0);

    // Fetch último historial al seleccionar proyecto o refrescar
    useEffect(() => {
        if (!proyectoId) {
            setUltimoHistorial(null);
            return;
        }
        api.get(`/proyectos/${proyectoId}/revision-excel/historial`)
            .then(r => {
                if (r.data && r.data.length > 0) {
                    setUltimoHistorial(r.data[0]); // El primero es el más reciente (ORDER BY created_at DESC)
                } else {
                    setUltimoHistorial(null);
                }
            })
            .catch(() => setUltimoHistorial(null));
    }, [proyectoId, refreshHistorial]);

    // Cuando cambia el selector
    const handleSelectProyecto = (e) => {
        const id = e.target.value;
        setProyectoId(id);
        setProyectoActual(proyectos.find(p => String(p.id) === String(id)) || null);
        setCambiosDetectados([]);
        setArchivoSubido(null);
        setArchivoUrlTemporal(null);
        setRefreshHistorial(0);
    };

    const handleEliminarHistorial = async (historialId) => {
        if (!window.confirm('¿Estás seguro de eliminar este registro del historial? Esta acción quedará registrada en las actividades.')) return;

        try {
            await api.delete(`/proyectos/${proyectoId}/revision-excel/historial/${historialId}`);
            alert('Registro eliminado correctamente.');
            setRefreshHistorial(prev => prev + 1);
        } catch (err) {
            console.error('Error eliminando historial:', err);
            alert(err.response?.data?.error || 'No se pudo eliminar el registro.');
        }
    };

    const handleEditarHistorial = async (h) => {
        const nuevoNombre = window.prompt('Nuevo nombre para esta versión:', h.nombre_archivo);
        if (!nuevoNombre || nuevoNombre === h.nombre_archivo) return;

        try {
            await api.put(`/proyectos/${proyectoId}/revision-excel/historial/${h.id}`, { nombre_archivo: nuevoNombre });
            alert('Nombre actualizado.');
            setRefreshHistorial(prev => prev + 1);
        } catch (err) {
            console.error('Error editando historial:', err);
            alert('No se pudo actualizar el nombre.');
        }
    };

    // Descargar Excel de revisión (Original de BD)
    const descargarExcel = async () => {
        if (!proyectoId) return;
        setCargando(true);
        try {
            const res = await api.get(`/proyectos/${proyectoId}/revision-excel/exportar`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `Revision_${proyectoActual?.nombre?.replace(/\s/g, '_') || proyectoId}.xlsx`;
            a.click();
        } catch { alert('Error al descargar el Excel de revisión.'); }
        setCargando(false);
    };

    // Subir Excel modificado
    const handleSubirExcel = async (e) => {
        const file = e.target.files[0];
        if (!file || !proyectoId) return;
        setCargando(true);
        const fd = new FormData();
        fd.append('archivo', file);
        try {
            const res = await api.post(`/proyectos/${proyectoId}/revision-excel/importar`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const cambios = res.data.cambios || [];
            setCambiosDetectados(cambios.map((c, i) => ({ ...c, _idx: i, _aceptado: true })));
            setArchivoSubido(file.name);
            setArchivoUrlTemporal(res.data.archivoUrl); // Nuevo campo del backend
            if (cambios.length === 0) alert('No se detectaron diferencias en el archivo subido.');
        } catch (err) {
            alert(err.response?.data?.error || 'Error procesando el Excel.');
        }
        setCargando(false);
        e.target.value = null;
    };

    const toggleCambio = (idx) => {
        setCambiosDetectados(prev => prev.map(c => c._idx === idx ? { ...c, _aceptado: !c._aceptado } : c));
    };

    const aceptarTodos = () => setCambiosDetectados(prev => prev.map(c => ({ ...c, _aceptado: true })));
    const rechazarTodos = () => setCambiosDetectados(prev => prev.map(c => ({ ...c, _aceptado: false })));

    // Aplicar cambios y guardar en historial
    const aplicarCambios = async () => {
        const seleccionados = cambiosDetectados.filter(c => c._aceptado);
        if (seleccionados.length === 0) { alert('Selecciona al menos un cambio.'); return; }
        if (!window.confirm(`¿Aplicar ${seleccionados.length} de ${cambiosDetectados.length} cambios?`)) return;
        setCargando(true);
        try {
            const res = await api.post(`/proyectos/${proyectoId}/revision-excel/aplicar`, {
                cambios: seleccionados.map(({ tipo, id, texto_propuesto, observacion, clave_propuesta, clave_actual, acronimo, clave }) => ({
                    tipo: tipo || 'atribucion_especifica', id, texto_propuesto, observacion, clave_propuesta, clave_actual, acronimo, clave
                })),
                nombreArchivo: archivoSubido,
                usuarioNombre: usuario?.nombre || 'Sistema',
                archivoUrl: archivoUrlTemporal,
            });

            const realAplicados = res.data.aplicados || 0;
            if (realAplicados === seleccionados.length) {
                alert(`✅ Los ${realAplicados} cambios se aplicaron con éxito.`);
            } else {
                alert(`⚠️ Se aplicaron ${realAplicados} de ${seleccionados.length} cambios. Revisa el historial para más detalles.`);
            }

            setCambiosDetectados([]);
            setArchivoSubido(null);
            setArchivoUrlTemporal(null);
            // Recargar historial
            setRefreshHistorial(prev => prev + 1);
            // Opcional: Recargar lista de proyectos para ver el cambio de estado 'en_revision'
            api.get('/proyectos').then(r => setProyectos(r.data));
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.error || 'Error al aplicar los cambios en el servidor.');
        }
        setCargando(false);
    };

    const aceptados = cambiosDetectados.filter(c => c._aceptado).length;
    const rechazados = cambiosDetectados.filter(c => !c._aceptado).length;
    const total = cambiosDetectados.length;

    // ── Render ────────────────────────────────────────────────────
    return (
        <div>
            {/* ── HEADER ── */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primario)', marginBottom: 4 }}>
                    🔍 Centro de Revisiones
                </h1>
                <p style={{ color: 'var(--color-texto-suave)', fontSize: 13 }}>
                    Exporta el Excel de un proyecto, captura observaciones y subsanaciones, súbelo y aplica los cambios.
                    Cada versión subida queda registrada en el historial de consulta.
                </p>
            </div>

            {/* ── SELECTOR DE PROYECTO ── */}
            <div className="card" style={{ marginBottom: 24, borderTop: '4px solid var(--color-primario)' }}>
                <div className="card-header">
                    <span className="card-title">📁 Seleccionar Proyecto</span>
                </div>
                {cargandoProyectos ? (
                    <div style={{ padding: 20, color: '#64748b' }}>⏳ Cargando proyectos...</div>
                ) : (
                    <div style={{ padding: '0 20px 20px' }}>
                        <select
                            className="form-control"
                            value={proyectoId}
                            onChange={handleSelectProyecto}
                            style={{ maxWidth: 520, marginBottom: 0 }}
                        >
                            <option value="">-- Elige un proyecto --</option>
                            {proyectos.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.nombre}  ({p.dependencia_nombre}) — {p.estado === 'en_revision' ? '🔍 En revisión' : p.estado === 'aprobado' ? '✅ Aprobado' : '✏️ Borrador'}
                                </option>
                            ))}
                        </select>
                        {proyectoActual && (
                            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primario)' }}>{proyectoActual.nombre}</span>
                                <span style={{ fontSize: 12, color: '#64748b' }}>— {proyectoActual.dependencia_nombre}</span>
                                <span className={`badge badge-${proyectoActual.estado}`}>
                                    {proyectoActual.estado === 'en_revision' ? '🔍 En revisión' : proyectoActual.estado === 'aprobado' ? '✅ Aprobado' : '✏️ Borrador'}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── FLUJO EXCEL (solo si hay proyecto seleccionado) ── */}
            {proyectoId && (
                <>
                    {/* Acciones */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 24 }}>
                        <div className="card" style={{ borderTop: '4px solid var(--color-primario)' }}>
                            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>1. Descargar Documento</h4>
                            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 18, lineHeight: 1.5 }}>
                                Genera un Excel con el árbol completo: atribuciones, glosario, ley y corresponsabilidades.
                                Las columnas <strong>Observaciones</strong> y <strong>Nueva Propuesta</strong> son editables en todas las hojas.
                            </p>
                            
                            {ultimoHistorial && ultimoHistorial.archivo_url ? (
                                <div style={{ marginBottom: 14, background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                    <p style={{ fontSize: 12, color: '#166534', margin: '0 0 8px 0', fontWeight: 600 }}>
                                        🌟 Último archivo subido disponible:
                                    </p>
                                    <a
                                        href={`${api.defaults.baseURL.replace('/api', '')}/uploads/revisiones/${ultimoHistorial.archivo_url}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-success"
                                        style={{ width: '100%', display: 'block', textAlign: 'center', marginBottom: 8 }}
                                    >
                                        📥 Bajar {ultimoHistorial.nombre_archivo}
                                    </a>
                                    <button 
                                        className="btn btn-outline btn-sm" 
                                        onClick={descargarExcel} 
                                        disabled={cargando} 
                                        style={{ width: '100%' }}
                                        title="Generar uno nuevo en blanco con la BD Actual"
                                    >
                                        {cargando ? '⏳ Generando original...' : '📄 Generar Nuevo en Blanco'}
                                    </button>
                                </div>
                            ) : (
                                <button className="btn btn-primary" onClick={descargarExcel} disabled={cargando} style={{ width: '100%' }}>
                                    {cargando ? '⏳ Generando original...' : '📤 Generar Nuevo Excel (BBDD)'}
                                </button>
                            )}
                        </div>

                        <div className="card" style={{ borderTop: '4px solid var(--color-exito)' }}>
                            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>2. Subir Subsanaciones</h4>
                            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 18, lineHeight: 1.5 }}>
                                Sube el Excel modificado. El sistema detectará cambios en atribuciones, glosario, ley y
                                <strong> corresponsabilidad</strong> para que se evalúen y apliquen.
                            </p>
                            <label className={`btn btn-success ${cargando ? 'disabled' : ''}`}
                                style={{ width: '100%', cursor: cargando ? 'not-allowed' : 'pointer', textAlign: 'center', display: 'block' }}>
                                {cargando ? '⏳ Leyendo Excel...' : '📤 Subir Archivo a Revisión'}
                                <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleSubirExcel} disabled={cargando} />
                            </label>
                        </div>
                    </div>

                    {/* Leyenda de tipos */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, fontSize: 12 }}>
                        {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
                            <span key={key} style={{ background: cfg.color, color: cfg.colorHeader, border: `1px solid ${cfg.colorBorde}`, borderRadius: 20, padding: '3px 12px', fontWeight: 700 }}>
                                {cfg.icono} {cfg.etiqueta}
                            </span>
                        ))}
                    </div>

                    {/* Verificador de cambios */}
                    {archivoSubido && (
                        <div className="card" style={{ border: '2px dashed var(--color-primario)', marginBottom: 24 }}>
                            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                                    <div>
                                        <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primario)', marginBottom: 6 }}>
                                            📑 Verificador de Cambios
                                        </h4>
                                        <p style={{ fontSize: 13, color: '#475569' }}>
                                            Archivo: <strong>{archivoSubido}</strong>
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 13 }}>✅ {aceptados} aceptado{aceptados !== 1 ? 's' : ''}</span>
                                        <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 13 }}>❌ {rechazados} rechazado{rechazados !== 1 ? 's' : ''}</span>
                                        <span style={{ background: '#e2e8f0', color: '#475569', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 13 }}>{total} total</span>
                                    </div>
                                </div>
                                {usuario.rol === 'enlace' && (
                                    <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 16, border: '1px solid #bae6fd' }}>
                                        ℹ️ Como <strong>enlace</strong>, puedes subir el documento subsanado para registrar el historial, pero solo el responsable o el administrador pueden aplicar los cambios a la base de datos.
                                    </div>
                                )}
                                {total > 1 && usuario.rol !== 'enlace' && (
                                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                                        <button className="btn btn-outline btn-sm" onClick={aceptarTodos} style={{ fontSize: 12 }}>✅ Aceptar todos</button>
                                        <button className="btn btn-outline btn-sm" onClick={rechazarTodos} style={{ fontSize: 12, borderColor: '#f87171', color: '#ef4444' }}>❌ Rechazar todos</button>
                                    </div>
                                )}
                            </div>

                            {cambiosDetectados.length === 0 ? (
                                <div className="empty-state" style={{ minHeight: 120 }}>
                                    <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                                    <h5>Sin cambios detectados</h5>
                                    <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => setArchivoSubido(null)}>Subir otro archivo</button>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '50vh', overflowY: 'auto', paddingRight: 6, marginBottom: 20 }}>
                                        {cambiosDetectados.map(c => (
                                            <TarjetaCambio key={c._idx} c={c} onToggle={usuario.rol !== 'enlace' ? toggleCambio : () => {}} />
                                        ))}
                                    </div>
                                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                                        <span style={{ fontSize: 13, color: '#64748b' }}>
                                            Se guardarán <strong style={{ color: '#16a34a' }}>{aceptados}</strong> de {total} cambios en tu Excel.
                                        </span>
                                        <div style={{ display: 'flex', gap: 12 }}>
                                            <button className="btn btn-outline" onClick={() => { setCambiosDetectados([]); setArchivoSubido(null); }}>❌ Descartar</button>
                                            <button 
                                                className="btn btn-primary" 
                                                onClick={aplicarCambios} 
                                                disabled={cargando || aceptados === 0 || usuario.rol === 'enlace'}
                                                title={usuario.rol === 'enlace' ? 'No tienes permiso para aplicar' : ''}
                                            >
                                                {cargando ? '⏳ Guardando...' : usuario.rol === 'enlace' ? '🔒 Aplicación Restringida' : `✅ Aplicar ${aceptados} Cambio${aceptados !== 1 ? 's' : ''}`}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── HISTORIAL ── */}
                    <div className="card" style={{ borderTop: '4px solid #8b5cf6' }}>
                        <div className="card-header">
                            <span className="card-title">📋 Historial de Revisiones Excel</span>
                            <span style={{ fontSize: 12, color: '#64748b' }}>Versiones subidas — solo consulta</span>
                        </div>
                        <HistorialVersiones
                            key={`${proyectoId}-${refreshHistorial}`}
                            proyectoId={proyectoId}
                            handleEliminarHistorial={handleEliminarHistorial}
                            handleEditarHistorial={handleEditarHistorial}
                        />
                    </div>
                </>
            )}

            {!proyectoId && !cargandoProyectos && (
                <div className="empty-state card" style={{ minHeight: 200 }}>
                    <div className="empty-icon">🔍</div>
                    <h3>Selecciona un proyecto</h3>
                    <p>Elige un proyecto del selector de arriba para comenzar el proceso de revisión.</p>
                </div>
            )}
        </div>
    );
}
