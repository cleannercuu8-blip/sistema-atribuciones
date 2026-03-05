import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import DashboardCarga from '../components/DashboardCarga';
import * as XLSX from 'xlsx';

// ==================== COMPONENTE ÁRBOL VISUAL ====================
const NodoArbol = ({ nodo, nivel = 0, onSeleccionar, seleccionado, puedeEditar, onEditar, onEliminar, revisionActiva, onObservar, esRevisor }) => {
    const [expandido, setExpandido] = useState(true);
    const hasChildren = nodo.hijos && nodo.hijos.length > 0;
    const colores = ['#1a3a5c', '#4a7db5', '#2e86de', '#27ae60', '#f39c12', '#8e44ad', '#e74c3c'];
    const color = colores[nivel % colores.length];

    return (
        <div className="tree-node">
            <div
                className={`tree-node-header ${seleccionado?.id === nodo.id ? 'selected' : ''}`}
                onClick={() => { onSeleccionar(nodo); setExpandido(!expandido); }}
            >
                <span style={{ fontSize: 12, color: '#999', minWidth: 20 }}>{hasChildren ? (expandido ? '▼' : '▶') : '•'}</span>
                <span className="tree-node-chip" style={{ background: color }}>{nodo.siglas}</span>
                <span style={{ fontSize: 13, color: 'var(--color-texto)', flex: 1, whiteSpace: 'normal', wordBreak: 'break-word', display: 'inline-block', verticalAlign: 'middle' }}>{nodo.nombre}</span>
                <span className="nivel-chip" style={{ flexShrink: 0 }}>Nivel {nodo.nivel_numero}</span>
                {puedeEditar && (
                    <div style={{ display: 'flex', gap: 4, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-icon btn-sm" onClick={() => onEditar(nodo)} title="Editar">✏️</button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => onEliminar(nodo.id)} title="Eliminar">🗑️</button>
                    </div>
                )}
                {revisionActiva && esRevisor && (
                    <div style={{ display: 'flex', gap: 4, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-warning btn-icon btn-sm" onClick={() => onObservar(nodo)} title="Observar">🚩</button>
                    </div>
                )}
            </div>
            {expandido && hasChildren && (
                <div className="tree-children">
                    {nodo.hijos.map(hijo => (
                        <NodoArbol key={hijo.id} nodo={hijo} nivel={nivel + 1} onSeleccionar={onSeleccionar} seleccionado={seleccionado} puedeEditar={puedeEditar} onEditar={onEditar} onEliminar={onEliminar} revisionActiva={revisionActiva} onObservar={onObservar} esRevisor={esRevisor} />
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
const TabAtribuciones = ({ proyectoId, unidad, setUnidad, arbol, atribGenerales, glosario, puedeEditarExterno, revisionActiva, onObservar }) => {
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

    const puedeEditarLocal = (usuario.rol === 'admin' || usuario.rol === 'revisor' || usuario.rol === 'enlace') && usuario.rol !== 'visualizador';
    const puedeEditar = puedeEditarExterno !== undefined ? puedeEditarExterno : puedeEditarLocal;

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
                                            <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'flex-start' }}>
                                                {puedeEditar && (
                                                    <>
                                                        <button className="btn btn-outline btn-icon btn-sm" onClick={() => abrirForm(a)} title="Editar" style={{ width: 36, height: 36 }}>✏️</button>
                                                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => eliminar(a.id)} title="Eliminar" style={{ width: 36, height: 36 }}>🗑️</button>
                                                    </>
                                                )}
                                                {revisionActiva && (usuario.rol === 'admin' || usuario.rol === 'revisor') && (
                                                    <button className="btn btn-warning btn-icon btn-sm" onClick={() => onObservar(a)} title="Observar" style={{ width: 36, height: 36 }}>🚩</button>
                                                )}
                                            </div>
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
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">🛡️ Corresponsabilidad (Glosario)</label>
                                    <select className="form-control" value={form.corresponsabilidad} onChange={e => setForm({ ...form, corresponsabilidad: e.target.value })}>
                                        <option value="">-- Ninguna --</option>
                                        {glosario?.map(g => <option key={g.id} value={g.acronimo}>{g.acronimo} - {g.significado.substring(0, 40)}...</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">👤 Responsable</label>
                                    <select className="form-control" value={form.responsable_id} onChange={e => setForm({ ...form, responsable_id: e.target.value })}>
                                        <option value="">-- Sin asignar --</option>
                                        {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">🤝 Apoyo (Selección múltiple)</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, maxHeight: 120, overflowY: 'auto', padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                    {usuarios.map(u => (
                                        <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                            <input
                                                type="checkbox"
                                                checked={form.apoyo_ids?.includes(u.id)}
                                                onChange={e => {
                                                    const ids = e.target.checked
                                                        ? [...(form.apoyo_ids || []), u.id]
                                                        : (form.apoyo_ids || []).filter(id => id !== u.id);
                                                    setForm({ ...form, apoyo_ids: ids });
                                                }}
                                            />
                                            {u.nombre}
                                        </label>
                                    ))}
                                </div>
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

    // Modo Revisión
    const [revisionActiva, setRevisionActiva] = useState(null); // ID de la revisión si estamos revisando
    const [mostrarModalObsRapida, setMostrarModalObsRapida] = useState(false);
    const [atribParaObservar, setAtribParaObservar] = useState(null);
    const [formObsRapida, setFormObsRapida] = useState({ texto_observacion: '' });

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
        } catch (err) { alert('Error en carga masiva Glosario'); }
        setExportando(false);
    };

    const handleCrearObsRapida = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/revisiones/${revisionActiva}/observaciones`, {
                ...formObsRapida,
                atribucion_especifica_id: atribParaObservar.id
            });
            setMostrarModalObsRapida(false);
            setAtribParaObservar(null);
            setFormObsRapida({ texto_observacion: '' });
            alert('✅ Observación guardada');
            // No recargamos todo el árbol para no perder contexto, 
            // pero la observación ya está en BD.
        } catch (err) { alert(err.response?.data?.error || 'Error'); }
    };

    const puedeEditar = (() => {
        if (usuario.rol === 'admin' || usuario.rol === 'revisor') return true;
        if (usuario.rol === 'visualizador') return false;
        if (!proyecto) return false;

        const matchesName = (str) => str === usuario.nombre || (str && str.includes(usuario.nombre));
        const matchesEmail = (str) => str === usuario.email || (str && str.includes(usuario.email));

        const esResponsable = matchesName(proyecto.responsable) || matchesEmail(proyecto.responsable);
        const esApoyo = matchesName(proyecto.responsable_apoyo) || matchesEmail(proyecto.responsable_apoyo);
        const esEnlaceAsignado = matchesName(proyecto.enlaces) || matchesEmail(proyecto.enlaces);

        return esResponsable || esApoyo || esEnlaceAsignado;
    })();

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
                                        revisionActiva={revisionActiva}
                                        onObservar={(u) => { setAtribParaObservar(u); setMostrarModalObsRapida(true); }}
                                        esRevisor={usuario?.rol === 'admin' || usuario?.rol === 'revisor'}
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
                        glosario={glosario}
                        puedeEditarExterno={puedeEditar}
                        revisionActiva={revisionActiva}
                        onObservar={(a) => { setAtribParaObservar(a); setMostrarModalObsRapida(true); }}
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

            {/* Revisiones movidas al menú principal /revisiones */}

            {/* Modal de Observación Rápida desde el Árbol */}
            {mostrarModalObsRapida && (
                <div className="modal-overlay" onClick={() => setMostrarModalObsRapida(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">🚩 Observar Atribución</h2>
                            <button className="modal-close" onClick={() => setMostrarModalObsRapida(false)}>×</button>
                        </div>
                        <div style={{ padding: '0 20px 10px', fontSize: 13, color: '#64748b' }}>
                            <strong>Atribución:</strong> {atribParaObservar?.clave} - {atribParaObservar?.texto}
                        </div>
                        <form onSubmit={handleCrearObsRapida}>
                            <div className="form-group">
                                <label className="form-label">Texto de la Observación <span className="required">*</span></label>
                                <textarea
                                    className="form-control"
                                    rows={5}
                                    value={formObsRapida.texto_observacion}
                                    onChange={e => setFormObsRapida({ ...formObsRapida, texto_observacion: e.target.value })}
                                    required
                                    placeholder="Explique qué debe corregirse..."
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn btn-outline" onClick={() => setMostrarModalObsRapida(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-danger">💾 Guardar y Capturar Snapshot</button>
                            </div>
                        </form>
                    </div>
                </div>
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

// ==================== TAB REVISIONES (SISTEMA EXCEL) ====================
const TabRevisiones = ({ proyectoId, usuario, revisionActiva, setRevisionActiva, setTab }) => {
    const [cargando, setCargando] = useState(false);
    const [cambiosDetectados, setCambiosDetectados] = useState([]);
    const [archivoSubido, setArchivoSubido] = useState(null);

    const descargarExcel = async () => {
        setCargando(true);
        try {
            const res = await api.get(`/proyectos/${proyectoId}/revision-excel/exportar`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `Revision_Proyecto_${proyectoId}.xlsx`;
            a.click();
        } catch (err) {
            alert('Error al descargar el archivo de Excel.');
        }
        setCargando(false);
    };

    const handleSubirExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
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
            if (cambios.length === 0) alert('No se detectaron diferencias en el archivo subido.');
        } catch (err) {
            alert(err.response?.data?.error || 'Error procesando el archivo Excel.');
        }
        setCargando(false);
        e.target.value = null;
    };

    const toggleCambio = (idx) => {
        setCambiosDetectados(prev =>
            prev.map(c => c._idx === idx ? { ...c, _aceptado: !c._aceptado } : c)
        );
    };

    const aceptarTodos = () => setCambiosDetectados(prev => prev.map(c => ({ ...c, _aceptado: true })));
    const rechazarTodos = () => setCambiosDetectados(prev => prev.map(c => ({ ...c, _aceptado: false })));

    const aplicarCambios = async () => {
        const seleccionados = cambiosDetectados.filter(c => c._aceptado);
        if (seleccionados.length === 0) {
            alert('No hay cambios aceptados. Acepta al menos uno.');
            return;
        }
        if (!window.confirm(`¿Confirmar? Se guardarán permanentemente ${seleccionados.length} de ${cambiosDetectados.length} cambios.`)) return;
        setCargando(true);
        try {
            await api.post(`/proyectos/${proyectoId}/revision-excel/aplicar`, {
                cambios: seleccionados.map(({ tipo, id, texto_propuesto, observacion, clave_propuesta, clave_actual }) => ({
                    tipo: tipo || 'atribucion_especifica',
                    id,
                    texto_propuesto,
                    observacion,
                    clave_propuesta,
                    clave_actual,
                }))
            });
            alert(`✅ ${seleccionados.length} cambio(s) aplicados con éxito.`);
            setCambiosDetectados([]);
            setArchivoSubido(null);
        } catch (err) {
            alert('Error al aplicar los cambios.');
        }
        setCargando(false);
    };

    const aceptados = cambiosDetectados.filter(c => c._aceptado).length;
    const rechazados = cambiosDetectados.filter(c => !c._aceptado).length;
    const totalCambios = cambiosDetectados.length;

    // Config visual por tipo de cambio
    const tipoConfig = {
        atribucion_especifica: {
            icono: '🔵',
            etiqueta: 'Atribución Específica',
            color: '#eff6ff',
            colorBorde: '#93c5fd',
            colorHeader: '#1d4ed8',
        },
        glosario: {
            icono: '📖',
            etiqueta: 'Glosario',
            color: '#f0fdf4',
            colorBorde: '#6ee7b7',
            colorHeader: '#15803d',
        },
        atribucion_general: {
            icono: '📜',
            etiqueta: 'Atribución General (Ley)',
            color: '#faf5ff',
            colorBorde: '#c084fc',
            colorHeader: '#7e22ce',
        },
        corresponsabilidad: {
            icono: '🔗',
            etiqueta: 'Corresponsabilidad',
            color: '#fff7ed',
            colorBorde: '#fdba74',
            colorHeader: '#c2410c',
        },
    };

    const renderTarjeta = (c) => {
        const cfg = tipoConfig[c.tipo] || tipoConfig['atribucion_especifica'];
        const esCorrsp = c.tipo === 'corresponsabilidad';
        const esGlosario = c.tipo === 'glosario';
        const esAG = c.tipo === 'atribucion_general';

        return (
            <div key={c._idx} style={{
                border: c._aceptado ? `1.5px solid #86efac` : `1.5px dashed #fca5a5`,
                borderRadius: 10,
                padding: 16,
                background: c._aceptado ? cfg.color : '#fff8f8',
                opacity: c._aceptado ? 1 : 0.65,
                transition: 'all 0.2s ease',
            }}>
                {/* Fila superior: tipo + ID + toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                            background: cfg.color, color: cfg.colorHeader,
                            border: `1px solid ${cfg.colorBorde}`,
                            borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 800,
                        }}>
                            {cfg.icono} {cfg.etiqueta}
                        </span>
                        {esCorrsp && (
                            <span style={{
                                background: '#fef9c3', color: '#92400e',
                                border: '1px solid #fde047',
                                borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                            }}>
                                ⚠️ Cambia jerarquía
                            </span>
                        )}
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                            Cambio #{c._idx + 1} · ID: {c.id} · {c.hoja}
                        </span>
                    </div>
                    <button
                        onClick={() => toggleCambio(c._idx)}
                        style={{
                            padding: '5px 18px', borderRadius: 8, border: 'none',
                            cursor: 'pointer', fontWeight: 700, fontSize: 13,
                            background: c._aceptado ? '#16a34a' : '#dc2626',
                            color: 'white', transition: 'background 0.2s', minWidth: 130,
                        }}
                        title={c._aceptado ? 'Clic para rechazar' : 'Clic para aceptar'}
                    >
                        {c._aceptado ? '✅ Aceptado' : '❌ Rechazado'}
                    </button>
                </div>

                {/* Observación */}
                {c.observacion ? (
                    <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>
                            📝 Observación del Revisor
                        </div>
                        <p style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5, margin: 0 }}>{c.observacion}</p>
                    </div>
                ) : (
                    <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '8px 14px', marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Sin observación capturada en el Excel</span>
                    </div>
                )}

                {/* Contenido de cambio */}
                {esCorrsp ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', marginBottom: 6 }}>
                                🔴 Relación actual (se cambiará)
                            </div>
                            <p style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.6, margin: 0 }}>
                                Vinculada a clave: <strong>{c.clave_actual || '(sin asignación)'}</strong>
                            </p>
                        </div>
                        <div style={{ background: '#fff7ed', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', marginBottom: 6 }}>
                                🟠 Nueva relación propuesta
                            </div>
                            <p style={{ fontSize: 13, color: '#7c2d12', lineHeight: 1.6, margin: 0 }}>
                                Vinculada a clave: <strong>{c.clave_propuesta || '(sin asignación)'}</strong>
                            </p>
                            <p style={{ fontSize: 11, color: '#9a3412', marginTop: 6, marginBottom: 0, fontStyle: 'italic' }}>
                                El sistema actualizará el vínculo hasta la Ley automáticamente.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', marginBottom: 6 }}>
                                🔴 {esGlosario ? 'Significado actual' : esAG ? 'Texto actual (Ley)' : 'Texto actual (se eliminará)'}
                            </div>
                            <del style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.6 }}>
                                {c.texto_original || '(Sin texto original)'}
                            </del>
                        </div>
                        <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#166534', textTransform: 'uppercase', marginBottom: 6 }}>
                                🟢 {esGlosario ? 'Nuevo significado' : esAG ? 'Nuevo texto (Ley)' : 'Propuesta del Excel (se guardará)'}
                            </div>
                            <p style={{ fontSize: 13, color: '#14532d', lineHeight: 1.6, margin: 0 }}>{c.texto_propuesto}</p>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primario)' }}>🔍 Gestión de Revisiones (Flujo Excel)</h3>
                    <p style={{ fontSize: 13, color: 'var(--color-texto-suave)', marginTop: 4 }}>
                        Flujo ágil basado en Excel: descarga, edita y sube el archivo para revisar cambios.
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 30 }}>
                <div className="card" style={{ borderTop: '4px solid var(--color-primario)' }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>1. Descargar Documento</h4>
                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.5 }}>
                        Genera un Excel con el árbol completo: atribuciones, glosario, ley y corresponsabilidades.
                        Las columnas <strong>Observaciones</strong> y <strong>Nueva Propuesta</strong> son editables en todas las hojas.
                    </p>
                    <button className="btn btn-primary" onClick={descargarExcel} disabled={cargando} style={{ width: '100%' }}>
                        {cargando ? '⏳ Generando documento...' : '📤 Exportar Excel para Revisión'}
                    </button>
                </div>

                <div className="card" style={{ borderTop: '4px solid var(--color-exito)' }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>2. Importar Subsanaciones</h4>
                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.5 }}>
                        Sube el Excel modificado. El sistema detectará cambios en atribuciones, glosario, ley y
                        <strong> corresponsabilidad</strong> para que los aceptes o rechaces uno a uno.
                    </p>
                    <label className={`btn btn-success ${cargando ? 'disabled' : ''}`} style={{ width: '100%', cursor: cargando ? 'not-allowed' : 'pointer', textAlign: 'center', display: 'block' }}>
                        {cargando ? '⏳ Leyendo Excel...' : '📥 Subir Excel Modificado'}
                        <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleSubirExcel} disabled={cargando} />
                    </label>
                </div>
            </div>

            {/* Leyenda de tipos */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, fontSize: 12 }}>
                {Object.entries(tipoConfig).map(([key, cfg]) => (
                    <span key={key} style={{
                        background: cfg.color, color: cfg.colorHeader,
                        border: `1px solid ${cfg.colorBorde}`,
                        borderRadius: 20, padding: '3px 12px', fontWeight: 700,
                    }}>
                        {cfg.icono} {cfg.etiqueta}
                    </span>
                ))}
            </div>

            {archivoSubido && (
                <div className="card" style={{ border: '2px dashed var(--color-primario)' }}>
                    <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primario)', marginBottom: 6 }}>
                                    📑 Verificador de Cambios Detectados
                                </h4>
                                <p style={{ fontSize: 13, color: '#475569' }}>
                                    Archivo: <strong>{archivoSubido}</strong> — Acepta o rechaza cada cambio individualmente.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 13 }}>
                                    ✅ {aceptados} aceptado{aceptados !== 1 ? 's' : ''}
                                </span>
                                <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 13 }}>
                                    ❌ {rechazados} rechazado{rechazados !== 1 ? 's' : ''}
                                </span>
                                <span style={{ background: '#e2e8f0', color: '#475569', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 13 }}>
                                    {totalCambios} total
                                </span>
                            </div>
                        </div>
                        {totalCambios > 1 && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                                <button className="btn btn-outline btn-sm" onClick={aceptarTodos} style={{ fontSize: 12 }}>✅ Aceptar todos</button>
                                <button className="btn btn-outline btn-sm" onClick={rechazarTodos} style={{ fontSize: 12, borderColor: '#f87171', color: '#ef4444' }}>❌ Rechazar todos</button>
                            </div>
                        )}
                    </div>

                    {cambiosDetectados.length === 0 ? (
                        <div className="empty-state" style={{ minHeight: 150, padding: 20 }}>
                            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                            <h5 style={{ fontSize: 15 }}>No hay alteraciones detectadas</h5>
                            <p style={{ fontSize: 13 }}>El archivo no contiene cambios respecto a la base de datos.</p>
                            <button className="btn btn-outline btn-sm" style={{ marginTop: 15 }} onClick={() => setArchivoSubido(null)}>Subir otro archivo</button>
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '55vh', overflowY: 'auto', paddingRight: 8, marginBottom: 20 }}>
                                {cambiosDetectados.map((c) => renderTarjeta(c))}
                            </div>

                            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, color: '#64748b' }}>
                                    Se guardarán <strong style={{ color: '#16a34a' }}>{aceptados}</strong> de {totalCambios} cambios.
                                </span>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <button className="btn btn-outline" onClick={() => { setCambiosDetectados([]); setArchivoSubido(null); }}>
                                        ❌ Descartar y Limpiar
                                    </button>
                                    <button className="btn btn-primary" onClick={aplicarCambios} disabled={cargando || aceptados === 0}>
                                        {cargando ? '⏳ Guardando...' : `✅ Aplicar ${aceptados} Cambio${aceptados !== 1 ? 's' : ''}`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
