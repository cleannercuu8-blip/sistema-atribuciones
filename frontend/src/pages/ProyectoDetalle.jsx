import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import DashboardCarga from '../components/DashboardCarga';
import * as XLSX from 'xlsx';

// ==================== COMPONENTE ÁRBOL VISUAL ====================
const NodoArbol = ({ nodo, nivel = 0, onSeleccionar, seleccionado, puedeEditar, onEditar, onEliminar }) => {
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
                <span style={{ fontSize: 13, color: 'var(--color-texto)', flex: 1, whiteSpace: 'normal', wordBreak: 'break-word', display: 'inline-block', verticalAlign: 'middle' }}>{nodo.nombre}</span>
                <span className="nivel-chip" style={{ flexShrink: 0 }}>Nivel {nodo.nivel_numero}</span>
                {puedeEditar && (
                    <div style={{ display: 'flex', gap: 4, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-icon btn-sm" onClick={() => onEditar(nodo)} title="Editar">✏️</button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => onEliminar(nodo.id)} title="Eliminar">🗑️</button>
                    </div>
                )}
            </div>
            {expandido && nodo.hijos?.length > 0 && (
                <div className="tree-children">
                    {nodo.hijos.map(hijo => (
                        <NodoArbol key={hijo.id} nodo={hijo} nivel={nivel + 1} onSeleccionar={onSeleccionar} seleccionado={seleccionado} puedeEditar={puedeEditar} onEditar={onEditar} onEliminar={onEliminar} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ==================== MINI NODO ÁRBOL (SIDEBAR) ====================
const MiniNodoArbol = ({ nodo, onSeleccionar, seleccionado }) => {
    const esActivo = seleccionado?.id === nodo.id;
    return (
        <div className="mini-tree-wrapper">
            <div
                className={`mini-tree-item ${esActivo ? 'active' : ''}`}
                onClick={() => onSeleccionar(nodo)}
            >
                <span className="mini-tree-icon">📄</span>
                <span className="mini-tree-label">{nodo.siglas}</span>
            </div>
            {nodo.hijos?.length > 0 && (
                <div className="mini-tree-children">
                    {nodo.hijos.map(h => (
                        <MiniNodoArbol key={h.id} nodo={h} onSeleccionar={onSeleccionar} seleccionado={seleccionado} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ==================== COMPONENTE ATRIBUCIONES ====================
const TabAtribuciones = ({ proyectoId, unidad, setUnidad, arbol, atribGenerales }) => {
    const { usuario } = useAuth();
    const [atribs, setAtribs] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [mostrarBulk, setMostrarBulk] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState({ clave: '', texto: '', tipo: 'normal', padre_atribucion_id: '', atribucion_general_id: '', corresponsabilidad: '', responsable_id: '', apoyo_ids: [] });
    const [usuarios, setUsuarios] = useState([]);
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

    const cargarUsuarios = async () => {
        try {
            const res = await api.get('/usuarios');
            setUsuarios(res.data);
        } catch { }
    };

    useEffect(() => {
        if (unidad) { cargar(); cargarPadres(); }
        cargarUsuarios();
    }, [unidad?.id]);

    const autoGenerarClave = (indexOffset = 0) => {
        const sig = unidad.siglas;
        const num = (atribs.length + 1 + indexOffset).toString().padStart(2, '0');
        return `${sig}${num}`;
    };

    const abrirForm = (item = null) => {
        if (item) {
            setEditando(item);
            setForm({
                clave: item.clave,
                texto: item.texto,
                tipo: item.tipo,
                padre_atribucion_id: item.padre_atribucion_id || '',
                atribucion_general_id: item.atribucion_general_id || '',
                corresponsabilidad: item.corresponsabilidad || '',
                responsable_id: item.responsable_id || '',
                apoyo_ids: item.apoyo_ids || []
            });
        } else {
            setEditando(null);
            setForm({
                clave: autoGenerarClave(),
                texto: '',
                tipo: 'normal',
                padre_atribucion_id: '',
                atribucion_general_id: '',
                corresponsabilidad: '',
                responsable_id: '',
                apoyo_ids: []
            });
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

    // Navegación por carpetas
    const getHijos = () => {
        if (!unidad) return arbol; // Nivel raíz
        return unidad.hijos || [];
    };

    const breadcrumbs = [];
    if (unidad) {
        const buildPath = (nodes, id, path = []) => {
            for (let n of nodes) {
                if (n.id === id) return [...path, n];
                if (n.hijos) {
                    const found = buildPath(n.hijos, id, [...path, n]);
                    if (found) return found;
                }
            }
            return null;
        };
        const pathUnits = buildPath(arbol, unidad.id);
        if (pathUnits) breadcrumbs.push(...pathUnits);
    }

    return (
        <div className="explorer-container">
            {/* SIDEBAR JURÍDICO-ADMINISTRATIVO */}
            <aside className="explorer-sidebar">
                <div className="explorer-sidebar-header">
                    <h5 style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-primario)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🌳 Estructura Orgánica</h5>
                    <p style={{ fontSize: 11, color: 'var(--color-texto-suave)', marginTop: 4 }}>Seleccione una unidad para gestionar</p>
                </div>
                <div className="explorer-tree-container">
                    <div
                        className={`mini-tree-item ${!unidad ? 'active' : ''}`}
                        onClick={() => setUnidad(null)}
                    >
                        <span className="mini-tree-icon">🏠</span>
                        <span className="mini-tree-label">Titular / Inicio</span>
                    </div>
                    {arbol.map(n => (
                        <MiniNodoArbol key={n.id} nodo={n} onSeleccionar={setUnidad} seleccionado={unidad} />
                    ))}
                </div>
            </aside>

            {/* CONTENIDO DEL EXPLORADOR */}
            <main className="explorer-content">
                <div className="breadcrumb" style={{ marginBottom: 24, background: '#f8fafc', padding: '10px 16px', borderRadius: 8 }}>
                    <span className="breadcrumb-item" onClick={() => setUnidad(null)} style={{ cursor: 'pointer', color: 'var(--color-acento)' }}>🏠 Inicio</span>
                    {breadcrumbs.map(b => (
                        <React.Fragment key={b.id}>
                            <span className="breadcrumb-separator">/</span>
                            <span className="breadcrumb-item" onClick={() => setUnidad(b)} style={{ cursor: 'pointer', color: b.id === unidad.id ? 'var(--color-primario)' : 'var(--color-acento)', fontWeight: b.id === unidad.id ? '700' : '400' }}>{b.siglas}</span>
                        </React.Fragment>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30, gap: 20 }}>
                    <div>
                        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-primario)', marginBottom: 6 }}>
                            {unidad ? unidad.nombre : 'Estructura Organizacional'}
                        </h2>
                        {unidad ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <span className="nivel-chip">Nivel {unidad.nivel_numero}</span>
                                <span className="nivel-chip" style={{ background: '#f1f5f9', color: '#475569' }}>{unidad.siglas}</span>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--color-texto-suave)', fontSize: 14 }}>Explore la jerarquía y gestione las atribuciones específicas de cada unidad.</p>
                        )}
                    </div>
                    {unidad && puedeEditar && (
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn btn-outline btn-sm" onClick={() => setMostrarBulk(true)}>📑 Carga Masiva</button>
                            <button className="btn btn-primary btn-sm" onClick={() => abrirForm()}>➕ Atribución</button>
                        </div>
                    )}
                </div>

                {/* Atribuciones Específicas */}
                {unidad ? (
                    <div>
                        <h4 style={{ fontSize: 12, color: 'var(--color-texto-suave)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>📝 Listado de Atribuciones</h4>
                        {cargando ? <div className="loading-container" style={{ minHeight: 200 }}><div className="spinner" /></div> : (
                            atribs.length === 0 ? (
                                <div className="explorer-empty">
                                    <div style={{ fontSize: 48, marginBottom: 15 }}>📝</div>
                                    <h3 style={{ fontSize: 18, color: 'var(--color-primario)' }}>Sin atribuciones registradas</h3>
                                    <p>Esta unidad administrativa no cuenta con atribuciones específicas en este proyecto.</p>
                                    {puedeEditar && <button className="btn btn-primary btn-sm" style={{ marginTop: 20 }} onClick={() => abrirForm()}>➕ Registrar Atribución</button>}
                                </div>
                            ) : (
                                <div className="atribucion-list">
                                    {atribs.map((a) => (
                                        <div key={a.id} className={`atribucion-card ${(a.atribucion_general_id || a.padre_atribucion_id) ? 'vinculada' : 'huerfana'}`}
                                            style={{
                                                border: '1px solid var(--color-borde)',
                                                borderLeftWidth: 6,
                                                borderRadius: 12,
                                                padding: 24,
                                                marginBottom: 20,
                                                background: a.tipo === 'indelegable' ? '#fff1f2' : 'white',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                gap: 24,
                                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)'
                                            }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                                                    <strong style={{ color: 'var(--color-primario)', fontSize: 16 }}>{a.clave}</strong>
                                                    <span className={`badge badge-${a.tipo}`}>
                                                        {a.tipo === 'normal' ? 'Delegable' : a.tipo}
                                                    </span>
                                                    {a.gen_clave && <span style={{ fontSize: 10, color: '#166534', background: '#dcfce7', padding: '4px 10px', borderRadius: 20, fontWeight: 800, textTransform: 'uppercase' }}>📜 LEY: {a.gen_clave}</span>}
                                                    {a.padre_clave && <span style={{ fontSize: 10, color: '#0369a1', background: '#e0f2fe', padding: '4px 10px', borderRadius: 20, fontWeight: 800, textTransform: 'uppercase' }}>🌳 SUP: {a.padre_clave}</span>}
                                                    {a.responsable_nombre && <span className="badge" style={{ background: '#f5f3ff', color: '#5b21b6', fontSize: 10, padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>👤 Resp: {a.responsable_nombre}</span>}
                                                    {a.apoyo_nombres?.length > 0 && <span className="badge" style={{ background: '#f0f9ff', color: '#0369a1', fontSize: 10, padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>🤝 Apoyo: {a.apoyo_nombres.join(', ')}</span>}
                                                    {a.corresponsabilidad && <span className="badge" style={{ background: '#fffbeb', color: '#92400e', fontSize: 10, padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>🛡️ {a.corresponsabilidad}</span>}
                                                </div>
                                                <p style={{ fontSize: 15, color: '#1e293b', lineHeight: 1.6, fontWeight: 500 }}>{a.texto}</p>
                                            </div>
                                            {puedeEditar && (
                                                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'flex-start' }}>
                                                    <button className="btn btn-outline btn-icon btn-sm" onClick={() => abrirForm(a)} title="Editar" style={{ width: 36, height: 36 }}>✏️</button>
                                                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => eliminar(a.id)} title="Eliminar" style={{ width: 36, height: 36 }}>🗑️</button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                ) : (
                    <div className="explorer-empty" style={{ background: '#f8fafc', borderRadius: 16, border: '2px dashed #e2e8f0' }}>
                        <div style={{ fontSize: 64, marginBottom: 20 }}>🔍</div>
                        <h3 style={{ fontSize: 20, color: 'var(--color-primario)', fontWeight: 800 }}>Navegador Orgánico</h3>
                        <p style={{ maxWidth: 400 }}>Utilice el árbol lateral o las carpetas de arriba para profundizar en los niveles de la institución y gestionar sus atribuciones.</p>
                    </div>
                )}
            </main>

            {/* Modal carga masiva */}
            {mostrarBulk && (
                <div className="modal-overlay" onClick={() => setMostrarBulk(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">📑 Carga Masiva: {unidad?.siglas}</h2>
                            <button className="modal-close" onClick={() => setMostrarBulk(false)}>×</button>
                        </div>
                        <div style={{ padding: '0 24px 24px' }}>
                            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>Pega las atribuciones (una por línea). Se generarán claves automáticas.</p>
                            <textarea className="form-control" rows={12} value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder="Ej:&#10;Supervisar proyectos...&#10;Autorizar presupuestos..." />
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                                <button className="btn btn-outline" onClick={() => setMostrarBulk(false)}>Cancelar</button>
                                <button className="btn btn-primary" onClick={guardarBulk} disabled={!bulkText.trim() || cargando}>
                                    {cargando ? '⌛ Procesando...' : `✅ Cargar ${bulkText.split('\n').filter(l => l.trim()).length} Atribuciones`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Individual */}
            {mostrarForm && (
                <div className="modal-overlay" onClick={() => setMostrarForm(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editando ? '✏️ Editar Atribución' : '➕ Nueva Atribución'}</h2>
                            <button className="modal-close" onClick={() => setMostrarForm(false)}>×</button>
                        </div>
                        <form onSubmit={guardar} style={{ padding: '0 24px 24px' }}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Clave <span className="required">*</span></label>
                                    <input className="form-control" value={form.clave} readOnly style={{ background: '#f1f5f9', cursor: 'not-allowed' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tipo</label>
                                    <select className="form-control" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                                        <option value="normal">Delegable</option>
                                        <option value="indelegable">Indelegable</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Texto <span className="required">*</span></label>
                                <textarea className="form-control" rows={5} value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })} required />
                            </div>

                            <div className="form-row">
                                {unidad.nivel_numero === 1 && atribGenerales.length > 0 && (
                                    <div className="form-group">
                                        <label className="form-label">Vínculo con Ley</label>
                                        <select className="form-control" value={form.atribucion_general_id} onChange={e => setForm({ ...form, atribucion_general_id: e.target.value })}>
                                            <option value="">-- Ninguno --</option>
                                            {atribGenerales.map(ag => <option key={ag.id} value={ag.id}>[{ag.clave}] {ag.texto.substring(0, 60)}...</option>)}
                                        </select>
                                    </div>
                                )}
                                {atribsPadre.length > 0 && (
                                    <div className="form-group">
                                        <label className="form-label">Vínculo Superior</label>
                                        <select className="form-control" value={form.padre_atribucion_id} onChange={e => setForm({ ...form, padre_atribucion_id: e.target.value })}>
                                            <option value="">-- Ninguno --</option>
                                            {atribsPadre.map(ap => <option key={ap.id} value={ap.id}>[{ap.clave}] {ap.texto.substring(0, 60)}...</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                                <button type="button" className="btn btn-outline" onClick={() => setMostrarForm(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">💾 Guardar Cambios</button>
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
    const [editandoUnidad, setEditandoUnidad] = useState(null);
    const [mostrarBulkAG, setMostrarBulkAG] = useState(false);
    const [bulkTextAG, setBulkTextAG] = useState('');
    const [mostrarBulkUnidades, setMostrarBulkUnidades] = useState(false);
    const [bulkTextUnidades, setBulkTextUnidades] = useState('');
    const [mostrarBulkGlosario, setMostrarBulkGlosario] = useState(false);
    const [bulkTextGlosario, setBulkTextGlosario] = useState('');
    const [archivoUnidades, setArchivoUnidades] = useState(null);
    const [previewUnidades, setPreviewUnidades] = useState([]);
    const [cargandoBulk, setCargandoBulk] = useState(false);
    const [editandoAG, setEditandoAG] = useState(null);
    const [editandoGlosario, setEditandoGlosario] = useState(null);

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
            if (editandoUnidad) {
                await api.put(`/unidades/${editandoUnidad.id}`, { ...formUnidad, padre_id: formUnidad.padre_id || null });
            } else {
                await api.post(`/proyectos/${id}/unidades`, { ...formUnidad, padre_id: formUnidad.padre_id || null });
            }
            setMostrarModalUnidad(false);
            setEditandoUnidad(null);
            cargar();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al procesar unidad');
        }
    };

    const abrirEditarUnidad = (u) => {
        setFormUnidad({ nombre: u.nombre, siglas: u.siglas, nivel_numero: u.nivel_numero, padre_id: u.padre_id || '' });
        setEditandoUnidad(u);
        setMostrarModalUnidad(true);
    };

    const eliminarUnidad = async (unidadId) => {
        if (!window.confirm('¿Estás seguro de eliminar esta unidad? Si tiene subordinados no podrá eliminarse.')) return;
        try {
            await api.delete(`/unidades/${unidadId}`);
            cargar();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al eliminar');
        }
    };

    const crearAG = async (e) => {
        e.preventDefault();
        try {
            if (editandoAG) {
                await api.put(`/atribuciones-generales/${editandoAG.id}`, formAG);
            } else {
                await api.post(`/proyectos/${id}/atribuciones-generales`, formAG);
            }
            setMostrarModalAG(false);
            setEditandoAG(null);
            cargar();
        } catch (err) {
            alert(err.response?.data?.error || 'Error');
        }
    };

    const abrirEditarAG = (ag) => {
        setFormAG({ clave: ag.clave, norma: ag.norma, articulo: ag.articulo, fraccion_parrafo: ag.fraccion_parrafo, texto: ag.texto });
        setEditandoAG(ag);
        setMostrarModalAG(true);
    };

    const crearGlosario = async (e) => {
        e.preventDefault();
        try {
            if (editandoGlosario) {
                await api.put(`/proyectos/${id}/glosario/${editandoGlosario.id}`, formGlosario);
            } else {
                await api.post(`/proyectos/${id}/glosario`, formGlosario);
            }
            setMostrarModalGlosario(false);
            setEditandoGlosario(null);
            cargar();
        } catch (err) {
            alert(err.response?.data?.error || 'Error');
        }
    };

    const abrirEditarGlosario = (g) => {
        setFormGlosario({ acronimo: g.acronimo, significado: g.significado });
        setEditandoGlosario(g);
        setMostrarModalGlosario(true);
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

    const guardarBulkAG = async () => {
        const lineas = bulkTextAG.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lineas.length === 0) return;
        setExportando(true);
        try {
            const items = lineas.map((l, i) => {
                const parts = l.split('|');
                if (parts.length >= 5) {
                    return { clave: parts[0].trim(), norma: parts[1].trim(), articulo: parts[2].trim(), fraccion_parrafo: parts[3].trim(), texto: parts[4].trim() };
                }
                const clave = `S${String(atribGenerales.length + 1 + i).padStart(2, '0')}`;
                return { clave, texto: l, norma: '', articulo: '', fraccion_parrafo: '' };
            });
            await api.post(`/proyectos/${id}/atribuciones-generales/masivo`, { items });
            setMostrarBulkAG(false);
            setBulkTextAG('');
            cargar();
        } catch (err) { alert(err.response?.data?.error || 'Error en carga masiva'); }
        setExportando(false);
    };

    // Descarga la plantilla de unidades como Excel
    const descargarPlantillaUnidades = () => {
        const wb = XLSX.utils.book_new();
        const data = [
            ['Nombre de la Unidad Administrativa', 'Siglas', 'Siglas del Superior (dejar vacío si es raíz)', 'Nivel'],
            ['Secretaría de Finanzas', 'SF', '', 1],
            ['Dirección General de Presupuesto', 'DGP', 'SF', 2],
            ['Departamento de Análisis', 'DA', 'DGP', 3]
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 30 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Unidades');
        XLSX.writeFile(wb, 'plantilla_unidades_administrativas.xlsx');
    };

    const handleArchivoUnidades = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setArchivoUnidades(file);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1); // skip header
            const parsed = rows
                .filter(r => r[0] && r[1])
                .map(r => ({
                    nombre: String(r[0]).trim(),
                    siglas: String(r[1]).trim(),
                    padre_siglas: r[2] ? String(r[2]).trim() : '',
                    nivel_numero: r[3] ? parseInt(r[3]) : (r[2] ? 2 : 1)
                }));
            setPreviewUnidades(parsed);
        };
        reader.readAsBinaryString(file);
    };

    const guardarBulkUnidades = async () => {
        if (previewUnidades.length === 0) return;
        setCargandoBulk(true);
        try {
            await api.post(`/proyectos/${id}/unidades/masivo`, { items: previewUnidades });
            setMostrarBulkUnidades(false);
            setArchivoUnidades(null);
            setPreviewUnidades([]);
            cargar();
            alert(`✅ ${previewUnidades.length} unidades cargadas correctamente`);
        } catch (err) { alert('Error: ' + (err.response?.data?.error || err.message)); }
        setCargandoBulk(false);
    };

    const guardarBulkGlosario = async () => {
        const lineas = bulkTextGlosario.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lineas.length === 0) return;
        setExportando(true);
        try {
            for (let linea of lineas) {
                const p = linea.split('|');
                if (p.length < 2) continue;
                await api.post(`/proyectos/${id}/glosario`, { acronimo: p[0].trim(), significado: p[1].trim() });
            }
            setMostrarBulkGlosario(false);
            setBulkTextGlosario('');
            cargar();
        } catch (err) { alert('Error en carga masiva Glosario'); }
        setExportando(false);
    };

    const puedeEditar = usuario.rol === 'admin' || usuario.rol === 'dependencia';

    if (cargando && !proyecto) return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 20px', width: 50, height: 50, borderWidth: 5 }} />
            <h2 style={{ color: 'var(--color-primario)' }}>⌛ Sincronizando Proyecto...</h2>
            <p style={{ color: '#64748b' }}>Cargando estructura orgánica, atribuciones y glosario</p>
            <div style={{ maxWidth: 300, height: 6, background: '#e2e8f0', borderRadius: 3, margin: '20px auto', overflow: 'hidden' }}>
                <div className="loading-bar-animation" style={{ height: '100%', background: 'var(--color-primario)', width: '60%' }} />
            </div>
        </div>
    );
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
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-outline btn-sm" onClick={() => setMostrarBulkUnidades(true)}>📑 Carga Masiva Unid.</button>
                                        <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                                            📤 Subir PDF
                                            <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={async (e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                const fd = new FormData();
                                                fd.append('archivo', file);
                                                try { await api.post(`/proyectos/${id}/organigrama`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); cargar(); }
                                                catch { alert('Error al subir PDF'); }
                                            }} />
                                        </label>
                                        <button className="btn btn-primary btn-sm" onClick={() => { setFormUnidad({ nombre: '', siglas: '', nivel_numero: 1, padre_id: '' }); setEditandoUnidad(null); setMostrarModalUnidad(true); }} id="btn-agregar-unidad">
                                            ➕ Agregar una
                                        </button>
                                    </div>
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
                                    <NodoArbol
                                        key={nodo.id}
                                        nodo={nodo}
                                        onSeleccionar={setUnidadSeleccionada}
                                        seleccionado={unidadSeleccionada}
                                        puedeEditar={puedeEditar}
                                        onEditar={abrirEditarUnidad}
                                        onEliminar={eliminarUnidad}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== TAB: ATRIBUCIONES ESPECÍFICAS ===== */}
            {tab === 'atribuciones' && (
                <div className="card" style={{ minHeight: '60vh' }}>
                    <TabAtribuciones
                        proyectoId={id}
                        arbol={arbol}
                        unidad={unidadSeleccionada}
                        setUnidad={setUnidadSeleccionada}
                        atribGenerales={atribGenerales}
                    />
                </div>
            )}


            {/* ===== TAB: ATRIBUCIONES GENERALES (LEY) ===== */}
            {tab === 'ley' && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">📜 Atribuciones Generales — Ley / Decreto</span>
                        {puedeEditar && (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-outline btn-sm" onClick={() => setMostrarBulkAG(true)}>📑 Carga Masiva</button>
                                <button className="btn btn-primary btn-sm" onClick={() => { setFormAG({ clave: `S${String(atribGenerales.length + 1).padStart(2, '0')}`, norma: '', articulo: '', fraccion_parrafo: '', texto: '' }); setMostrarModalAG(true); }} id="btn-agregar-ley">➕ Agregar una</button>
                            </div>
                        )}
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
                                                <td style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-outline btn-icon btn-sm" onClick={() => abrirEditarAG(ag)} title="Editar">✏️</button>
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
                        {puedeEditar && (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-outline btn-sm" onClick={() => setMostrarBulkGlosario(true)}>📑 Carga Masiva</button>
                                <button className="btn btn-primary btn-sm" onClick={() => { setFormGlosario({ acronimo: '', significado: '' }); setMostrarModalGlosario(true); }}>➕ Agregar</button>
                            </div>
                        )}
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
                                                <td style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-outline btn-icon btn-sm" onClick={() => abrirEditarGlosario(g)} title="Editar">✏️</button>
                                                    <button className="btn btn-danger btn-icon btn-sm" onClick={async () => { if (window.confirm('¿Eliminar?')) { await api.delete(`/proyectos/${id}/glosario/${g.id}`); cargar(); } }}>🗑️</button>
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

            {/* ===== TAB: REVISIONES ===== */}
            {tab === 'revisiones' && (
                <TabRevisiones proyectoId={id} usuario={usuario} />
            )}

            {/* Modal: Nueva Unidad */}
            {mostrarModalUnidad && (
                <div className="modal-overlay" onClick={() => setMostrarModalUnidad(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editandoUnidad ? '✏️ Editar Unidad Administrativa' : '➕ Nueva Unidad Administrativa'}</h2>
                            <button className="modal-close" onClick={() => { setMostrarModalUnidad(false); setEditandoUnidad(null); }}>×</button>
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
                                <button type="button" className="btn btn-outline" onClick={() => { setMostrarModalUnidad(false); setEditandoUnidad(null); }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" id="btn-guardar-unidad">
                                    {editandoUnidad ? '💾 Guardar cambios' : '✅ Crear unidad'}
                                </button>
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
                            <h2 className="modal-title">{editandoAG ? '✏️ Editar Atribución de Ley' : '📜 Nueva Atribución de Ley'}</h2>
                            <button className="modal-close" onClick={() => { setMostrarModalAG(false); setEditandoAG(null); }}>×</button>
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
                            <h2 className="modal-title">{editandoGlosario ? '✏️ Editar Acrónimo' : '📖 Nuevo Acrónimo'}</h2>
                            <button className="modal-close" onClick={() => { setMostrarModalGlosario(false); setEditandoGlosario(null); }}>×</button>
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

            {/* Modal carga masiva AG */}
            {mostrarBulkAG && (
                <div className="modal-overlay" onClick={() => setMostrarBulkAG(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">📑 Carga Masiva de Ley</h2>
                            <button className="modal-close" onClick={() => setMostrarBulkAG(false)}>×</button>
                        </div>
                        <div style={{ padding: '0 20px 20px' }}>
                            <p style={{ fontSize: 13, color: '#666', marginBottom: 15 }}>
                                Pega aquí los artículos de ley, uno por cada línea. Se generarán automáticamente las claves SXX.
                            </p>
                            <textarea
                                className="form-control"
                                rows={10}
                                value={bulkTextAG}
                                onChange={e => setBulkTextAG(e.target.value)}
                                placeholder={"Ejemplo:\nAdministrar los recursos financieros...\nValidar la legalidad de los actos...\nCuidar el cumplimiento de..."}
                            />
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn btn-outline" onClick={() => setMostrarBulkAG(false)}>Cancelar</button>
                                <button type="button" className="btn btn-primary" onClick={guardarBulkAG} disabled={!bulkTextAG.trim() || exportando}>
                                    {exportando ? '⌛ Cargando...' : `✅ Cargar ${bulkTextAG.split('\n').filter(l => l.trim()).length} artículos`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CARGA MASIVA UNIDADES (Excel) */}
            {mostrarBulkUnidades && (
                <div className="modal-overlay" onClick={() => { setMostrarBulkUnidades(false); setArchivoUnidades(null); setPreviewUnidades([]); }}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">🌳 Carga Masiva de Unidades</h2>
                            <button className="modal-close" onClick={() => { setMostrarBulkUnidades(false); setArchivoUnidades(null); setPreviewUnidades([]); }}></button>
                        </div>
                        <div style={{ padding: '0 24px 24px' }}>
                            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                                <p style={{ fontSize: 13, fontWeight: 700, color: '#0369a1', margin: '0 0 6px' }}> Instrucciones</p>
                                <ul style={{ fontSize: 13, color: '#0c4a6e', margin: '0 0 0 16px', padding: 0 }}>
                                    <li><strong>Columna A</strong>: Nombre completo de la Unidad Administrativa</li>
                                    <li><strong>Columna B</strong>: Siglas únicas (p. ej. DGP)</li>
                                    <li><strong>Columna C</strong>: Siglas del superior (vacío si es raíz)</li>
                                    <li><strong>Columna D</strong>: Nivel jerárquico (número, p. ej. 1, 2, 3)</li>
                                </ul>
                            </div>
                            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                                <button type="button" className="btn btn-outline" onClick={descargarPlantillaUnidades}>
                                    Descargar Plantilla Excel
                                </button>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', background: 'var(--color-primario)', color: '#fff', fontSize: 14, fontWeight: 600 }}>
                                    {archivoUnidades ? archivoUnidades.name : 'Seleccionar archivo Excel'}
                                    <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleArchivoUnidades} />
                                </label>
                            </div>
                            {previewUnidades.length > 0 && (
                                <div>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
                                        Vista previa: <span style={{ color: 'var(--color-primario)' }}>{previewUnidades.length} unidades detectadas</span>
                                    </p>
                                    <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc' }}>
                                                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Nombre</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', width: 80 }}>Siglas</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', width: 110 }}>Superior</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', width: 60 }}>Nivel</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewUnidades.map((u, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '7px 12px' }}>{u.nombre}</td>
                                                        <td style={{ padding: '7px 12px' }}>
                                                            <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11 }}>{u.siglas}</span>
                                                        </td>
                                                        <td style={{ padding: '7px 12px', color: u.padre_siglas ? '#374151' : '#9ca3af', fontStyle: u.padre_siglas ? 'normal' : 'italic' }}>
                                                            {u.padre_siglas || '(raíz)'}
                                                        </td>
                                                        <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                                                            <span style={{ fontWeight: 700, color: '#64748b' }}>{u.nivel_numero}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                                <button className="btn btn-outline" onClick={() => { setMostrarBulkUnidades(false); setArchivoUnidades(null); setPreviewUnidades([]); }}>Cancelar</button>
                                <button className="btn btn-primary" onClick={guardarBulkUnidades} disabled={cargandoBulk || previewUnidades.length === 0}>
                                    {cargandoBulk ? ' Cargando...' : ` Cargar ${previewUnidades.length} unidades`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {mostrarBulkGlosario && (
                <div className="modal-overlay" onClick={() => setMostrarBulkGlosario(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">📖 Carga Masiva Glosario</h2>
                            <button className="modal-close" onClick={() => setMostrarBulkGlosario(false)}>×</button>
                        </div>
                        <div style={{ padding: '0 24px 24px' }}>
                            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 15 }}>Formato: <strong>SIGLAS|Significado completo</strong> (Una por línea)</p>
                            <textarea className="form-control" rows={12} value={bulkTextGlosario} onChange={e => setBulkTextGlosario(e.target.value)} placeholder="Ej:&#10;SEP|Secretaría de Educación Pública&#10;LFPDPPP|Ley Federal de Protección de Datos Personales..." />
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button className="btn btn-outline" onClick={() => setMostrarBulkGlosario(false)}>Cancelar</button>
                                <button className="btn btn-primary" onClick={guardarBulkGlosario} disabled={exportando}>
                                    {exportando ? '⌛ Procesando...' : '🚀 Cargar Glosario'}
                                </button>
                            </div>
                        </div>
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
    const [editandoObs, setEditandoObs] = useState(null);

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

    const eliminarRevision = async (revId) => {
        if (!window.confirm('¿Eliminar esta revisión y todas sus observaciones?')) return;
        try {
            await api.delete(`/revisiones/${revId}`);
            if (seleccionada?.id === revId) setSeleccionada(null);
            cargarRevisiones();
        } catch { alert('Error al eliminar revisión'); }
    };

    const eliminarObservacion = async (obsId) => {
        if (!window.confirm('¿Eliminar esta observación?')) return;
        try {
            await api.delete(`/revisiones/observaciones/${obsId}`);
            cargarObservaciones(seleccionada.id);
            cargarRevisiones();
        } catch { alert('Error al eliminar observación'); }
    };

    const abrirFormEditarObs = (obs) => {
        setFormObs({ texto_observacion: obs.texto_observacion });
        setEditandoObs(obs);
        setMostrarFormObs(true);
    };

    const crearObservacion = async (e) => {
        e.preventDefault();
        try {
            if (editandoObs) {
                await api.put(`/revisiones/observaciones/${editandoObs.id}`, formObs);
            } else {
                await api.post(`/revisiones/${seleccionada.id}/observaciones`, formObs);
            }
            setMostrarFormObs(false);
            setEditandoObs(null);
            cargarObservaciones(seleccionada.id);
            cargarRevisiones();
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
                            <div key={rev.id} className="card" style={{ cursor: 'pointer', borderLeft: `4px solid ${rev.estado === 'abierta' ? 'var(--color-acento)' : 'var(--color-exito)'}`, marginBottom: 12, padding: 16, position: 'relative' }}
                                onClick={() => seleccionarRevision(rev)}>
                                {esRevisor && (
                                    <button className="btn-close" style={{ position: 'absolute', top: 8, right: 8, color: '#999', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); eliminarRevision(rev.id); }}>🗑️</button>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <strong style={{ color: 'var(--color-primario)' }}>Revisión #{rev.numero_revision}</strong>
                                    <span className={`badge badge-${rev.estado}`}>{rev.estado}</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--color-texto-suave)', display: 'grid', gap: 2 }}>
                                    <span>👤 Revisor: {rev.revisor_nombre}</span>
                                    <span>📅 Plazo: {rev.dias_habiles_plazo} días</span>
                                    {rev.fecha_limite && <span>⌛ Límite: {new Date(rev.fecha_limite).toLocaleDateString('es-MX')}</span>}
                                </div>
                                <div style={{ fontSize: 11, marginTop: 8, display: 'flex', gap: 6 }}>
                                    <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>{rev.obs_pendientes} ⏳</span>
                                    <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>{rev.obs_total} total</span>
                                </div>
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

                            <div style={{ marginTop: 24 }}>
                                {observaciones.map(o => (
                                    <ObservacionCard key={o.id} obs={o} esDependencia={esDependencia} esRevisor={esRevisor} onSubsanar={subsanar} onEditar={() => abrirFormEditarObs(o)} onEliminar={() => eliminarObservacion(o.id)} />
                                ))}
                            </div>

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
}

// ==================== CARD OBSERVACIÓN ====================
const ObservacionCard = ({ obs, esDependencia, esRevisor, onSubsanar, onEditar, onEliminar }) => {
    const [mostrarForm, setMostrarForm] = useState(false);
    const [respuesta, setRespuesta] = useState('');

    const handleSubsanar = async (e) => {
        e.preventDefault();
        await onSubsanar(obs.id, respuesta);
        setMostrarForm(false);
    };

    return (
        <div style={{ border: `1px solid ${obs.estado === 'pendiente' ? '#fca5a5' : '#a7f3d0'}`, borderRadius: 8, padding: 16, marginBottom: 16, background: obs.estado === 'pendiente' ? '#fff5f5' : '#f0fdf4', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span className={`badge badge-${obs.estado}`}>{obs.estado === 'pendiente' ? '⏳ Pendiente' : '✅ Subsanada'}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#999' }}>{new Date(obs.created_at).toLocaleDateString('es-MX')}</span>
                    {esRevisor && obs.estado === 'pendiente' && (
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-outline btn-xs" onClick={onEditar} title="Editar">✏️</button>
                            <button className="btn btn-danger btn-xs" onClick={onEliminar} title="Eliminar">🗑️</button>
                        </div>
                    )}
                </div>
            </div>
            <p style={{ fontSize: 14, color: 'var(--color-texto)', marginBottom: 10, lineHeight: 1.5 }}>{obs.texto_observacion}</p>
            {obs.respuesta && (
                <div style={{ fontSize: 13, color: '#166534', background: '#dcfce7', padding: '10px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <strong>✅ Respuesta:</strong> {obs.respuesta}
                </div>
            )}
            {obs.estado === 'pendiente' && esDependencia && !mostrarForm && (
                <button className="btn btn-success btn-sm" style={{ marginTop: 10 }} onClick={() => setMostrarForm(true)}>✅ Responder / Subsanar</button>
            )}
            {mostrarForm && (
                <form onSubmit={handleSubsanar} style={{ marginTop: 12 }}>
                    <textarea className="form-control" rows={3} value={respuesta} onChange={e => setRespuesta(e.target.value)} placeholder="Describa cómo se subsanó la observación..." required style={{ marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button type="submit" className="btn btn-success btn-sm">Confirmar</button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setMostrarForm(false)}>Cancelar</button>
                    </div>
                </form>
            )}
        </div>
    );
};
