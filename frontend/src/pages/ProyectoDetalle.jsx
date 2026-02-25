import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// ==================== COMPONENTE ÁRBOL VISUAL ====================
const NodoArbol = ({ nodo, nivel = 0, onSeleccionar, seleccionado }) => {
    const [expandido, setExpandido] = useState(true);
    const colores = ['#1a3a5c', '#4a7db5', '#2e86de', '#27ae60', '#f39c12', '#8e44ad', '#e74c3c'];
    const color = colores[nivel % colores.length];

    return (
        <div className="tree-node">
            <div
                className={`tree-node-header ${seleccionado?.id === nodo.id ? 'selected' : ''}`}
                onClick={() => { onSeleccionar(nodo); setExpandido(!expandido); }}
            >
                <span style={{ fontSize: 12, color: '#999', minWidth: 20 }}>{nodo.hijos?.length > 0 ? (expandido ? '▼' : '▶') : '•'}</span>
                <span className="tree-node-chip" style={{ background: color }}>{nodo.siglas}</span>
                <span style={{ fontSize: 13.5, color: 'var(--color-texto)', flex: 1 }}>{nodo.nombre}</span>
                <span className="nivel-chip">Nivel {nodo.nivel_numero}</span>
            </div>
            {expandido && nodo.hijos?.length > 0 && (
                <div className="tree-children">
                    {nodo.hijos.map(hijo => (
                        <NodoArbol key={hijo.id} nodo={hijo} nivel={nivel + 1} onSeleccionar={onSeleccionar} seleccionado={seleccionado} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ==================== COMPONENTE ATRIBUCIONES ====================
const TabAtribuciones = ({ proyectoId, unidad, atribGenerales }) => {
    const { usuario } = useAuth();
    const [atribs, setAtribs] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [mostrarBulk, setMostrarBulk] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState({ clave: '', texto: '', tipo: 'normal', padre_atribucion_id: '', atribucion_general_id: '' });
    const [atribsPadre, setAtribsPadre] = useState([]);

    const cargar = async () => {
        setCargando(true);
        try {
            const res = await api.get(`/proyectos/${proyectoId}/atribuciones-especificas?unidad_id=${unidad.id}`);
            setAtribs(res.data);
        } catch { }
        setCargando(false);
    };

    const cargarPadres = async () => {
        if (unidad.nivel_numero < 1) return;
        try {
            // Obtener todas las atribuciones para filtrar las del nivel superior
            const res = await api.get(`/proyectos/${proyectoId}/atribuciones-especificas`);
            const del_nivel_anterior = res.data.filter(a => a.nivel_numero === unidad.nivel_numero - 1);
            setAtribsPadre(del_nivel_anterior);
        } catch { }
    };

    useEffect(() => {
        if (unidad) { cargar(); cargarPadres(); }
    }, [unidad?.id]);

    const autoGenerarClave = (indexOffset = 0) => {
        const sig = unidad.siglas;
        const num = (atribs.length + 1 + indexOffset).toString().padStart(2, '0');
        return `${sig}${num}`;
    };

    const abrirForm = (item = null) => {
        if (item) {
            setEditando(item);
            setForm({ clave: item.clave, texto: item.texto, tipo: item.tipo, padre_atribucion_id: item.padre_atribucion_id || '', atribucion_general_id: item.atribucion_general_id || '' });
        } else {
            setEditando(null);
            setForm({ clave: autoGenerarClave(), texto: '', tipo: 'normal', padre_atribucion_id: '', atribucion_general_id: '' });
        }
        setMostrarForm(true);
    };

    const guardar = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...form, unidad_id: unidad.id, padre_atribucion_id: form.padre_atribucion_id || null, atribucion_general_id: form.atribucion_general_id || null };
            if (editando) {
                await api.put(`/atribuciones-generales/especificas/${editando.id}`, payload);
            } else {
                await api.post(`/proyectos/${proyectoId}/atribuciones-especificas`, payload);
            }
            setMostrarForm(false);
            cargar();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al guardar');
        }
    };

    const guardarBulk = async () => {
        const lineas = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lineas.length === 0) return;

        setCargando(true);
        try {
            for (let i = 0; i < lineas.length; i++) {
                const payload = {
                    clave: autoGenerarClave(i),
                    texto: lineas[i],
                    tipo: 'normal',
                    unidad_id: unidad.id,
                    padre_atribucion_id: null,
                    atribucion_general_id: null
                };
                await api.post(`/proyectos/${proyectoId}/atribuciones-especificas`, payload);
            }
            setMostrarBulk(false);
            setBulkText('');
            cargar();
        } catch (err) {
            alert('Error parcial al cargar: ' + (err.response?.data?.error || err.message));
        }
        setCargando(false);
    };

    const eliminar = async (id) => {
        if (!window.confirm('¿Eliminar esta atribución?')) return;
        try {
            await api.delete(`/atribuciones-generales/especificas/${id}`);
            cargar();
        } catch { }
    };

    const puedeEditar = usuario.rol === 'admin' || usuario.rol === 'dependencia';

    if (!unidad) return <div className="empty-state"><div className="empty-icon">👈</div><p>Seleccione una unidad del organigrama</p></div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primario)' }}>
                        Atribuciones de: <span style={{ color: 'var(--color-acento)' }}>{unidad.nombre} ({unidad.siglas})</span>
                    </h3>
                    <span className="nivel-chip">Nivel {unidad.nivel_numero}</span>
                </div>
                {puedeEditar && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setMostrarBulk(true)}>📑 Carga Masiva</button>
                        <button className="btn btn-primary btn-sm" onClick={() => abrirForm()} id="btn-agregar-atribucion">➕ Agregar una</button>
                    </div>
                )}
            </div>

            {cargando ? <div className="loading-container"><div className="spinner" /></div> : (
                atribs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📝</div>
                        <h3>Sin atribuciones</h3>
                        <p>Agrega la primera atribución para esta unidad</p>
                    </div>
                ) : (
                    <div>
                        {atribs.map((a, i) => (
                            <div key={a.id} style={{ border: '1px solid var(--color-borde)', borderRadius: 8, padding: 14, marginBottom: 10, background: a.tipo === 'indelegable' ? '#fce7f3' : 'white' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                            <strong style={{ color: 'var(--color-primario)', fontSize: 13 }}>{a.clave}</strong>
                                            <span className={`badge badge-${a.tipo}`}>{a.tipo}</span>
                                            {a.gen_clave && <span style={{ fontSize: 11, color: '#999' }}>← Ley: {a.gen_clave}</span>}
                                            {a.padre_clave && <span style={{ fontSize: 11, color: '#666' }}>← {a.padre_clave}</span>}
                                        </div>
                                        <p style={{ fontSize: 13.5, color: 'var(--color-texto)' }}>{a.texto}</p>
                                    </div>
                                    {puedeEditar && (
                                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                            <button className="btn btn-outline btn-icon btn-sm" onClick={() => abrirForm(a)}>✏️</button>
                                            <button className="btn btn-danger btn-icon btn-sm" onClick={() => eliminar(a.id)}>🗑️</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Modal carga masiva */}
            {mostrarBulk && (
                <div className="modal-overlay" onClick={() => setMostrarBulk(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">📑 Carga Masiva de Atribuciones</h2>
                            <button className="modal-close" onClick={() => setMostrarBulk(false)}>×</button>
                        </div>
                        <div style={{ padding: '0 20px 20px' }}>
                            <p style={{ fontSize: 13, color: '#666', marginBottom: 15 }}>
                                Pega aquí las atribuciones, una por cada línea. Se generarán automáticamente las claves siguiendo el patrón {unidad.siglas}XX.
                            </p>
                            <textarea
                                className="form-control"
                                rows={10}
                                value={bulkText}
                                onChange={e => setBulkText(e.target.value)}
                                placeholder={"Ejemplo:\nSupervisar la ejecución técnica...\nCoordinar las acciones de mejora...\nAtender las solicitudes de..."}
                            />
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn btn-outline" onClick={() => setMostrarBulk(false)}>Cancelar</button>
                                <button type="button" className="btn btn-primary" onClick={guardarBulk} disabled={!bulkText.trim() || cargando}>
                                    {cargando ? '⌛ Cargando...' : `✅ Cargar ${bulkText.split('\n').filter(l => l.trim()).length} atribuciones`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal atribución individual */}
            {mostrarForm && (
                <div className="modal-overlay" onClick={() => setMostrarForm(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editando ? '✏️ Editar atribución' : '➕ Nueva atribución'}</h2>
                            <button className="modal-close" onClick={() => setMostrarForm(false)}>×</button>
                        </div>
                        <form onSubmit={guardar}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Clave <span className="required">*</span></label>
                                    <input className="form-control" value={form.clave} onChange={e => setForm({ ...form, clave: e.target.value })} required placeholder={`${unidad.siglas}01`} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tipo</label>
                                    <select className="form-control" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                                        <option value="normal">Normal</option>
                                        <option value="indelegable">Indelegable</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Texto de la atribución <span className="required">*</span></label>
                                <textarea className="form-control" rows={4} value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })} required placeholder="Ej: Supervisar la elaboración de los programas educativos..." />
                            </div>
                            {atribGenerales.length > 0 && (
                                <div className="form-group">
                                    <label className="form-label">Se deriva de (atribución de ley)</label>
                                    <select className="form-control" value={form.atribucion_general_id} onChange={e => setForm({ ...form, atribucion_general_id: e.target.value })}>
                                        <option value="">-- Sin relación directa con ley --</option>
                                        {atribGenerales.map(ag => (
                                            <option key={ag.id} value={ag.id}>[{ag.clave}] {ag.texto?.substring(0, 80)}...</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {atribsPadre.length > 0 && (
                                <div className="form-group">
                                    <label className="form-label">Se relaciona con (nivel superior: {atribsPadre[0]?.unidad_siglas})</label>
                                    <select className="form-control" value={form.padre_atribucion_id} onChange={e => setForm({ ...form, padre_atribucion_id: e.target.value })}>
                                        <option value="">-- Sin relación con nivel superior --</option>
                                        {atribsPadre.map(ap => (
                                            <option key={ap.id} value={ap.id}>[{ap.clave}] {ap.texto?.substring(0, 80)}...</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn btn-outline" onClick={() => setMostrarForm(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">💾 Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==================== PÁGINA PRINCIPAL ====================
export default function ProyectoDetalle() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { usuario } = useAuth();
    const [proyecto, setProyecto] = useState(null);
    const [arbol, setArbol] = useState([]);
    const [atribGenerales, setAtribGenerales] = useState([]);
    const [glosario, setGlosario] = useState([]);
    const [tab, setTab] = useState('organigrama');
    const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [mostrarModalUnidad, setMostrarModalUnidad] = useState(false);
    const [mostrarModalAG, setMostrarModalAG] = useState(false);
    const [mostrarModalGlosario, setMostrarModalGlosario] = useState(false);
    const [formUnidad, setFormUnidad] = useState({ nombre: '', siglas: '', nivel_numero: 1, padre_id: '' });
    const [formAG, setFormAG] = useState({ clave: '', norma: '', articulo: '', fraccion_parrafo: '', texto: '' });
    const [formGlosario, setFormGlosario] = useState({ acronimo: '', significado: '' });
    const [unidadesPlanas, setUnidadesPlanas] = useState([]);
    const [exportando, setExportando] = useState(false);

    const cargar = async () => {
        try {
            const [pRes, arbolRes, agRes, glosRes, uPlanaRes] = await Promise.all([
                api.get(`/proyectos/${id}`),
                api.get(`/proyectos/${id}/unidades`),
                api.get(`/proyectos/${id}/atribuciones-generales`),
                api.get(`/proyectos/${id}/glosario`),
                api.get(`/proyectos/${id}/unidades/plana`),
            ]);
            setProyecto(pRes.data);
            setArbol(arbolRes.data);
            setAtribGenerales(agRes.data);
            setGlosario(glosRes.data);
            setUnidadesPlanas(uPlanaRes.data);
        } catch { }
        setCargando(false);
    };

    useEffect(() => { cargar(); }, [id]);

    const crearUnidad = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/proyectos/${id}/unidades`, { ...formUnidad, padre_id: formUnidad.padre_id || null });
            setMostrarModalUnidad(false);
            cargar();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al crear unidad');
        }
    };

    const crearAG = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/proyectos/${id}/atribuciones-generales`, formAG);
            setMostrarModalAG(false);
            cargar();
        } catch (err) {
            alert(err.response?.data?.error || 'Error');
        }
    };

    const crearGlosario = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/proyectos/${id}/glosario`, formGlosario);
            setMostrarModalGlosario(false);
            cargar();
        } catch (err) {
            alert(err.response?.data?.error || 'Error');
        }
    };

    const exportar = async () => {
        setExportando(true);
        try {
            const res = await api.get(`/proyectos/${id}/exportar`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `atribuciones-${proyecto.nombre}.xlsx`;
            a.click();
        } catch { alert('Error al exportar'); }
        setExportando(false);
    };

    const puedeEditar = usuario.rol === 'admin' || usuario.rol === 'dependencia';

    if (cargando) return <div className="loading-container"><div className="spinner" /><p>Cargando proyecto...</p></div>;
    if (!proyecto) return <div className="empty-state card"><h3>Proyecto no encontrado</h3></div>;

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 }}>
                <div>
                    <button className="btn btn-outline btn-sm" onClick={() => navigate('/proyectos')} style={{ marginBottom: 12 }}>
                        ← Volver
                    </button>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primario)' }}>{proyecto.nombre}</h1>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                        <span style={{ fontSize: 13, color: 'var(--color-texto-suave)' }}>🏢 {proyecto.dependencia_nombre}</span>
                        <span className={`badge badge-${proyecto.estado}`}>
                            {proyecto.estado === 'borrador' ? '✏️ Borrador' : proyecto.estado === 'en_revision' ? '🔍 En revisión' : '✅ Aprobado'}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-success" onClick={exportar} disabled={exportando} id="btn-exportar-excel">
                        {exportando ? '⏳ Generando...' : '📥 Exportar Excel'}
                    </button>
                    {proyecto.organigrama_url && (
                        <a className="btn btn-outline" href={`${import.meta.env.VITE_API_URL || ''}${proyecto.organigrama_url}`} target="_blank" rel="noreferrer">
                            📄 Ver Organigrama PDF
                        </a>
                    )}
                </div>
            </div>

            {/* TABS */}
            <div className="tabs">
                {[
                    { id: 'organigrama', label: '🌳 Organigrama' },
                    { id: 'ley', label: '📜 Atrib. Generales (Ley)' },
                    { id: 'atribuciones', label: '📝 Atribuciones' },
                    { id: 'glosario', label: '📖 Glosario' },
                    { id: 'revisiones', label: '🔍 Revisiones' }
                ].map(t => (
                    <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ===== TAB: ORGANIGRAMA ===== */}
            {tab === 'organigrama' && (
                <div>
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">🌳 Estructura del Organigrama</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {proyecto.organigrama_url && (
                                    <a className="btn btn-outline btn-sm" href={`${import.meta.env.VITE_API_URL || ''}${proyecto.organigrama_url}`} target="_blank" rel="noreferrer">📄 Ver PDF</a>
                                )}
                                {puedeEditar && usuario.rol === 'admin' && (
                                    <>
                                        <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                                            📤 Subir PDF organigrama
                                            <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={async (e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                const fd = new FormData();
                                                fd.append('archivo', file);
                                                try { await api.post(`/proyectos/${id}/organigrama`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); cargar(); }
                                                catch { alert('Error al subir PDF'); }
                                            }} />
                                        </label>
                                        <button className="btn btn-primary btn-sm" onClick={() => { setFormUnidad({ nombre: '', siglas: '', nivel_numero: 1, padre_id: '' }); setMostrarModalUnidad(true); }} id="btn-agregar-unidad">
                                            ➕ Agregar unidad
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        {arbol.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">🌳</div>
                                <h3>Sin unidades administrativas</h3>
                                <p>Agrega las unidades del organigrama para comenzar</p>
                            </div>
                        ) : (
                            <div className="tree">
                                {arbol.map(nodo => (
                                    <NodoArbol key={nodo.id} nodo={nodo} onSeleccionar={setUnidadSeleccionada} seleccionado={unidadSeleccionada} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== TAB: ATRIBUCIONES ESPECÍFICAS ===== */}
            {tab === 'atribuciones' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 320px) 1fr', gap: 20, alignItems: 'start' }}>
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div className="card-header">
                            <span className="card-title" style={{ fontSize: 13 }}>🌳 Estructura</span>
                        </div>
                        <div className="tree" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            {arbol.map(nodo => (
                                <NodoArbol key={nodo.id} nodo={nodo} onSeleccionar={setUnidadSeleccionada} seleccionado={unidadSeleccionada} />
                            ))}
                        </div>
                    </div>
                    <div className="card">
                        <TabAtribuciones proyectoId={id} unidad={unidadSeleccionada} atribGenerales={atribGenerales} />
                    </div>
                </div>
            )}

            {/* ===== TAB: ATRIBUCIONES GENERALES (LEY) ===== */}
            {tab === 'ley' && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">📜 Atribuciones Generales — Ley / Decreto</span>
                        {puedeEditar && <button className="btn btn-primary btn-sm" onClick={() => { setFormAG({ clave: `S${String(atribGenerales.length + 1).padStart(2, '0')}`, norma: '', articulo: '', fraccion_parrafo: '', texto: '' }); setMostrarModalAG(true); }} id="btn-agregar-ley">➕ Agregar</button>}
                    </div>
                    {atribGenerales.length === 0 ? (
                        <div className="empty-state"><div className="empty-icon">📜</div><h3>Sin atribuciones de ley</h3><p>Captura las atribuciones del fundamento legal</p></div>
                    ) : (
                        <div className="table-responsive">
                            <table>
                                <thead><tr><th>Clave</th><th>Norma</th><th>Artículo</th><th>Fracción/Párrafo</th><th>Texto</th>{puedeEditar && <th>Acc.</th>}</tr></thead>
                                <tbody>
                                    {atribGenerales.map(ag => (
                                        <tr key={ag.id}>
                                            <td><strong>{ag.clave}</strong></td>
                                            <td>{ag.norma || '-'}</td>
                                            <td>{ag.articulo || '-'}</td>
                                            <td>{ag.fraccion_parrafo || '-'}</td>
                                            <td style={{ maxWidth: 400 }}>{ag.texto}</td>
                                            {puedeEditar && (
                                                <td>
                                                    <button className="btn btn-danger btn-icon btn-sm" onClick={async () => { if (window.confirm('¿Eliminar?')) { await api.delete(`/atribuciones-generales/${ag.id}`); cargar(); } }}>🗑️</button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ===== TAB: GLOSARIO ===== */}
            {tab === 'glosario' && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">📖 Glosario de Acrónimos</span>
                        {puedeEditar && <button className="btn btn-primary btn-sm" onClick={() => { setFormGlosario({ acronimo: '', significado: '' }); setMostrarModalGlosario(true); }}>➕ Agregar</button>}
                    </div>
                    {glosario.length === 0 ? (
                        <div className="empty-state"><div className="empty-icon">📖</div><h3>Sin acrónimos</h3></div>
                    ) : (
                        <div className="table-responsive">
                            <table>
                                <thead><tr><th>Acrónimo</th><th>Significado</th>{puedeEditar && <th>Acc.</th>}</tr></thead>
                                <tbody>
                                    {glosario.map(g => (
                                        <tr key={g.id}>
                                            <td><strong>{g.acronimo}</strong></td>
                                            <td>{g.significado}</td>
                                            {puedeEditar && (
                                                <td><button className="btn btn-danger btn-icon btn-sm" onClick={async () => { if (window.confirm('¿Eliminar?')) { await api.delete(`/proyectos/${id}/glosario/${g.id}`); cargar(); } }}>🗑️</button></td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ===== TAB: REVISIONES ===== */}
            {tab === 'revisiones' && (
                <TabRevisiones proyectoId={id} usuario={usuario} />
            )}

            {/* Modal: Nueva Unidad */}
            {mostrarModalUnidad && (
                <div className="modal-overlay" onClick={() => setMostrarModalUnidad(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">➕ Nueva Unidad Administrativa</h2>
                            <button className="modal-close" onClick={() => setMostrarModalUnidad(false)}>×</button>
                        </div>
                        <form onSubmit={crearUnidad}>
                            <div className="form-group">
                                <label className="form-label">Nombre completo <span className="required">*</span></label>
                                <input className="form-control" value={formUnidad.nombre} onChange={e => setFormUnidad({ ...formUnidad, nombre: e.target.value })} placeholder="Ej: Subsecretaría de Administración" required />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Siglas únicas <span className="required">*</span></label>
                                    <input className="form-control" value={formUnidad.siglas} onChange={e => setFormUnidad({ ...formUnidad, siglas: e.target.value.toUpperCase() })} placeholder="SA, SAdm, DGP..." required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Número de nivel <span className="required">*</span></label>
                                    <input type="number" className="form-control" min="1" value={formUnidad.nivel_numero} onChange={e => setFormUnidad({ ...formUnidad, nivel_numero: parseInt(e.target.value) })} required />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Depende de (unidad superior)</label>
                                <select className="form-control" value={formUnidad.padre_id} onChange={e => setFormUnidad({ ...formUnidad, padre_id: e.target.value })}>
                                    <option value="">-- Ninguno (nivel raíz) --</option>
                                    {unidadesPlanas.map(u => (
                                        <option key={u.id} value={u.id}>{u.siglas} - {u.nombre} (Nivel {u.nivel_numero})</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn btn-outline" onClick={() => setMostrarModalUnidad(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" id="btn-guardar-unidad">✅ Crear unidad</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Nueva Atribución General */}
            {mostrarModalAG && (
                <div className="modal-overlay" onClick={() => setMostrarModalAG(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">📜 Nueva Atribución de Ley</h2>
                            <button className="modal-close" onClick={() => setMostrarModalAG(false)}>×</button>
                        </div>
                        <form onSubmit={crearAG}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Clave <span className="required">*</span></label>
                                    <input className="form-control" value={formAG.clave} onChange={e => setFormAG({ ...formAG, clave: e.target.value })} required placeholder="S01" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Norma</label>
                                    <input className="form-control" value={formAG.norma} onChange={e => setFormAG({ ...formAG, norma: e.target.value })} placeholder="LOPF, Reglamento..." />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Artículo</label>
                                    <input className="form-control" value={formAG.articulo} onChange={e => setFormAG({ ...formAG, articulo: e.target.value })} placeholder="1, 5 Bis..." />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fracción / Párrafo</label>
                                    <input className="form-control" value={formAG.fraccion_parrafo} onChange={e => setFormAG({ ...formAG, fraccion_parrafo: e.target.value })} placeholder="V, XI, Párrafo 3..." />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Texto <span className="required">*</span></label>
                                <textarea className="form-control" rows={4} value={formAG.texto} onChange={e => setFormAG({ ...formAG, texto: e.target.value })} required placeholder="Texto del artículo de ley..." />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn btn-outline" onClick={() => setMostrarModalAG(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">✅ Agregar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Glosario */}
            {mostrarModalGlosario && (
                <div className="modal-overlay" onClick={() => setMostrarModalGlosario(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">📖 Nuevo Acrónimo</h2>
                            <button className="modal-close" onClick={() => setMostrarModalGlosario(false)}>×</button>
                        </div>
                        <form onSubmit={crearGlosario}>
                            <div className="form-group">
                                <label className="form-label">Acrónimo <span className="required">*</span></label>
                                <input className="form-control" value={formGlosario.acronimo} onChange={e => setFormGlosario({ ...formGlosario, acronimo: e.target.value })} required placeholder="LOPF" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Significado <span className="required">*</span></label>
                                <input className="form-control" value={formGlosario.significado} onChange={e => setFormGlosario({ ...formGlosario, significado: e.target.value })} required placeholder="Ley Orgánica del Poder Ejecutivo Federal" />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn btn-outline" onClick={() => setMostrarModalGlosario(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">✅ Agregar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==================== TAB REVISIONES ====================
const TabRevisiones = ({ proyectoId, usuario }) => {
    const [revisiones, setRevisiones] = useState([]);
    const [seleccionada, setSeleccionada] = useState(null);
    const [observaciones, setObservaciones] = useState([]);
    const [mostrarFormRev, setMostrarFormRev] = useState(false);
    const [formRev, setFormRev] = useState({ dias_habiles_plazo: 10, notas: '' });
    const [formObs, setFormObs] = useState({ texto_observacion: '' });
    const [mostrarFormObs, setMostrarFormObs] = useState(false);

    const cargarRevisiones = async () => {
        const res = await api.get(`/proyectos/${proyectoId}/revisiones`);
        setRevisiones(res.data);
    };

    const cargarObservaciones = async (revId) => {
        const res = await api.get(`/revisiones/${revId}/observaciones`);
        setObservaciones(res.data);
    };

    useEffect(() => { cargarRevisiones(); }, []);

    const seleccionarRevision = (rev) => {
        setSeleccionada(rev);
        cargarObservaciones(rev.id);
    };

    const crearRevision = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/proyectos/${proyectoId}/revisiones`, formRev);
            setMostrarFormRev(false);
            cargarRevisiones();
        } catch (err) { alert(err.response?.data?.error || 'Error'); }
    };

    const crearObservacion = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/revisiones/${seleccionada.id}/observaciones`, formObs);
            setMostrarFormObs(false);
            cargarObservaciones(seleccionada.id);
        } catch (err) { alert(err.response?.data?.error || 'Error'); }
    };

    const subsanar = async (obsId, respuesta) => {
        await api.put(`/revisiones/observaciones/${obsId}/subsanar`, { respuesta });
        cargarObservaciones(seleccionada.id);
        cargarRevisiones();
    };

    const cerrarRevision = async () => {
        if (!window.confirm('¿Cerrar esta revisión?')) return;
        await api.put(`/revisiones/${seleccionada.id}/cerrar`);
        setSeleccionada(null);
        cargarRevisiones();
    };

    const esRevisor = usuario.rol === 'admin' || usuario.rol === 'revisor';
    const esDependencia = usuario.rol === 'dependencia';

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primario)' }}>🔍 Historial de Revisiones</h3>
                {esRevisor && <button className="btn btn-primary btn-sm" onClick={() => setMostrarFormRev(true)} id="btn-nueva-revision">➕ Nueva revisión</button>}
            </div>

            {revisiones.length === 0 ? (
                <div className="empty-state card"><div className="empty-icon">🔍</div><h3>Sin revisiones</h3><p>No se han iniciado revisiones en este proyecto</p></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: seleccionada ? '300px 1fr' : '1fr', gap: 20 }}>
                    <div>
                        {revisiones.map(rev => (
                            <div key={rev.id} className="card" style={{ cursor: 'pointer', borderLeft: `4px solid ${rev.estado === 'abierta' ? '#f39c12' : '#27ae60'}`, marginBottom: 12, padding: 16 }}
                                onClick={() => seleccionarRevision(rev)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <strong>Revisión #{rev.numero_revision}</strong>
                                    <span className={`badge badge-${rev.estado}`}>{rev.estado}</span>
                                </div>
                                <p style={{ fontSize: 12, color: 'var(--color-texto-suave)' }}>Revisor: {rev.revisor_nombre}</p>
                                <p style={{ fontSize: 12, color: 'var(--color-texto-suave)' }}>Plazo: {rev.dias_habiles_plazo} días hábiles</p>
                                <p style={{ fontSize: 12, color: 'var(--color-texto-suave)' }}>Límite: {rev.fecha_limite ? new Date(rev.fecha_limite).toLocaleDateString('es-MX') : '-'}</p>
                                <p style={{ fontSize: 12, marginTop: 4 }}>
                                    <span className="badge badge-pendiente">{rev.obs_pendientes} pendientes</span>{' '}
                                    <span style={{ fontSize: 11, color: '#999' }}>{rev.obs_total} total</span>
                                </p>
                            </div>
                        ))}
                    </div>

                    {seleccionada && (
                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Revisión #{seleccionada.numero_revision} — Observaciones</h3>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {esRevisor && seleccionada.estado === 'abierta' && (
                                        <>
                                            <button className="btn btn-primary btn-sm" onClick={() => { setFormObs({ texto_observacion: '' }); setMostrarFormObs(true); }}>➕ Observación</button>
                                            <button className="btn btn-success btn-sm" onClick={cerrarRevision}>✅ Cerrar sin Word</button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {esRevisor && seleccionada.estado === 'abierta' && (
                                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '20px' }}>
                                    <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>📤 Entregar Producto Final (.docx)</h4>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <input
                                            type="file"
                                            accept=".docx"
                                            className="form-control"
                                            style={{ flex: 1 }}
                                            onChange={async (e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                if (!window.confirm('¿Subir este archivo como producto final y CERRAR la revisión?')) return;

                                                const fd = new FormData();
                                                fd.append('archivo', file);
                                                try {
                                                    await api.post(`/revisiones/${seleccionada.id}/producto-final`, fd, {
                                                        headers: { 'Content-Type': 'multipart/form-data' }
                                                    });
                                                    alert('✅ Producto final subido y revisión cerrada.');
                                                    setSeleccionada(null);
                                                    cargarRevisiones();
                                                } catch (err) {
                                                    alert(err.response?.data?.error || 'Error al subir producto');
                                                }
                                            }}
                                        />
                                    </div>
                                    <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Nota: Al subir el archivo, la revisión se marcará como <strong>cerrada</strong> automáticamente.</p>
                                </div>
                            )}

                            {seleccionada.producto_word && (
                                <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', color: '#166534' }}>📄 <strong>Producto Final:</strong> {seleccionada.producto_word}</span>
                                    <a
                                        href={`${import.meta.env.VITE_API_URL || ''}/uploads/productos/${seleccionada.producto_word}`}
                                        className="btn btn-outline btn-sm"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        📥 Descargar
                                    </a>
                                </div>
                            )}

                            {observaciones.length === 0 ? (
                                <div className="empty-state"><div className="empty-icon">📋</div><h3>Sin observaciones</h3></div>
                            ) : (
                                observaciones.map(obs => (
                                    <ObservacionCard key={obs.id} obs={obs} esDependencia={esDependencia} onSubsanar={subsanar} />
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Modal nueva revisión */}
            {mostrarFormRev && (
                <div className="modal-overlay" onClick={() => setMostrarFormRev(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">➕ Nueva Revisión</h2>
                            <button className="modal-close" onClick={() => setMostrarFormRev(false)}>×</button>
                        </div>
                        <form onSubmit={crearRevision}>
                            <div className="form-group">
                                <label className="form-label">Días hábiles para subsanación</label>
                                <input type="number" className="form-control" min="1" value={formRev.dias_habiles_plazo} onChange={e => setFormRev({ ...formRev, dias_habiles_plazo: parseInt(e.target.value) })} />
                                <small style={{ color: 'var(--color-texto-suave)', fontSize: 12 }}>Por defecto: 10 días hábiles</small>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Notas iniciales</label>
                                <textarea className="form-control" rows={3} value={formRev.notas} onChange={e => setFormRev({ ...formRev, notas: e.target.value })} placeholder="Notas generales de esta revisión..." />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn btn-outline" onClick={() => setMostrarFormRev(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">📋 Crear revisión</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal nueva observación */}
            {mostrarFormObs && (
                <div className="modal-overlay" onClick={() => setMostrarFormObs(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">📝 Nueva Observación</h2>
                            <button className="modal-close" onClick={() => setMostrarFormObs(false)}>×</button>
                        </div>
                        <form onSubmit={crearObservacion}>
                            <div className="form-group">
                                <label className="form-label">Observación <span className="required">*</span></label>
                                <textarea className="form-control" rows={5} value={formObs.texto_observacion} onChange={e => setFormObs({ ...formObs, texto_observacion: e.target.value })} required placeholder="Describa la observación..." />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn btn-outline" onClick={() => setMostrarFormObs(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">💾 Guardar observación</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==================== CARD OBSERVACIÓN ====================
const ObservacionCard = ({ obs, esDependencia, onSubsanar }) => {
    const [mostrarForm, setMostrarForm] = useState(false);
    const [respuesta, setRespuesta] = useState('');

    const handleSubsanar = async (e) => {
        e.preventDefault();
        await onSubsanar(obs.id, respuesta);
        setMostrarForm(false);
    };

    return (
        <div style={{ border: `1px solid ${obs.estado === 'pendiente' ? '#fca5a5' : '#a7f3d0'}`, borderRadius: 8, padding: 14, marginBottom: 12, background: obs.estado === 'pendiente' ? '#fff5f5' : '#f0fdf4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className={`badge badge-${obs.estado}`}>{obs.estado === 'pendiente' ? '⏳ Pendiente' : '✅ Subsanada'}</span>
                <span style={{ fontSize: 11, color: '#999' }}>{new Date(obs.created_at).toLocaleDateString('es-MX')}</span>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--color-texto)', marginBottom: 8 }}>{obs.texto_observacion}</p>
            {obs.respuesta && <p style={{ fontSize: 12.5, color: 'var(--color-exito)', background: '#d1fae5', padding: '6px 10px', borderRadius: 6 }}>✅ Respuesta: {obs.respuesta}</p>}
            {obs.estado === 'pendiente' && esDependencia && !mostrarForm && (
                <button className="btn btn-success btn-sm" style={{ marginTop: 8 }} onClick={() => setMostrarForm(true)}>✅ Subsanar</button>
            )}
            {mostrarForm && (
                <form onSubmit={handleSubsanar} style={{ marginTop: 10 }}>
                    <textarea className="form-control" rows={3} value={respuesta} onChange={e => setRespuesta(e.target.value)} placeholder="Describa cómo se subsanó la observación..." required style={{ marginBottom: 8 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button type="submit" className="btn btn-success btn-sm">Confirmar subsanación</button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setMostrarForm(false)}>Cancelar</button>
                    </div>
                </form>
            )}
        </div>
    );
};
