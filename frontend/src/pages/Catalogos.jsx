import React, { useState, useEffect } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';

export default function Catalogos() {
    const [tab, setTab] = useState('dependencias');
    const [responsables, setResponsables] = useState([]);
    const [enlaces, setEnlaces] = useState([]);
    const [dependencias, setDependencias] = useState([]);
    const [avances, setAvances] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [archivo, setArchivo] = useState(null);
    const [preview, setPreview] = useState([]);
    const [mostrandoModalCarga, setMostrandoModalCarga] = useState(false);
    const [procesando, setProcesando] = useState(false);

    // Estado para carga individual
    const [formIndividual, setFormIndividual] = useState({ nombre: '', email: '', tipo: 'centralizada' });
    const [agregandoIndividual, setAgregandoIndividual] = useState(false);

    const cargarDatos = async () => {
        setCargando(true);
        try {
            const [rRes, eRes, dRes, aRes] = await Promise.all([
                api.get('/catalogos/responsables'),
                api.get('/catalogos/enlaces'),
                api.get('/catalogos/dependencias'),
                api.get('/catalogos/avances')
            ]);
            setResponsables(rRes.data);
            setEnlaces(eRes.data);
            setDependencias(dRes.data);
            setAvances(aRes.data);
        } catch (err) {
            console.error('Error al cargar catálogos', err);
        }
        setCargando(false);
    };

    useEffect(() => { cargarDatos(); }, []);

    const handleIndividualSubmit = async (e) => {
        e.preventDefault();
        setAgregandoIndividual(true);
        try {
            const endpoint = `/catalogos/${tab}`;
            const payload = tab === 'enlaces'
                ? { nombre: formIndividual.nombre, email: formIndividual.email }
                : tab === 'dependencias'
                    ? { nombre: formIndividual.nombre, tipo: formIndividual.tipo }
                    : { nombre: formIndividual.nombre };

            await api.post(endpoint, payload);
            setFormIndividual({ nombre: '', email: '', tipo: 'centralizada' });
            cargarDatos();
            alert('✅ Registro agregado correctamente');
        } catch (err) {
            alert(err.response?.data?.error || 'Error al agregar registro');
        }
        setAgregandoIndividual(false);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setArchivo(file);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            setPreview(data);
        };
        reader.readAsBinaryString(file);
    };

    const descargarPlantilla = async () => {
        try {
            const response = await api.get(`/catalogos/plantilla/${tab}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `plantilla_${tab}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert('Error al descargar plantilla');
        }
    };

    const confirmCargaMasiva = async () => {
        if (preview.length === 0) return;
        setProcesando(true);
        try {
            let payload = [];
            if (tab === 'responsables') {
                payload = preview.map(row => row['Nombre del Responsable']).filter(n => n);
            } else if (tab === 'enlaces') {
                payload = preview.map(row => ({
                    nombre: row['Nombre del Enlace'],
                    email: row['Correo Electrónico']
                })).filter(item => item.nombre && item.email);
            } else if (tab === 'avances') {
                payload = preview.map(row => row['Estado de Avance']).filter(n => n);
            } else if (tab === 'dependencias') {
                payload = preview.map(row => ({
                    nombre: row['Nombre de Dependencia'],
                    tipo: row['Tipo (centralizada, paraestatal, organismo_autonomo)']
                })).filter(item => item.nombre && item.tipo);
            }

            await api.post(`/catalogos/${tab}/masivo`, { items: payload });
            setMostrandoModalCarga(false);
            setPreview([]);
            setArchivo(null);
            cargarDatos();
            alert('✅ Carga masiva completada con éxito');
        } catch (err) {
            alert(err.response?.data?.error || 'Error al procesar carga masiva');
        }
        setProcesando(false);
    };

    const limpiarCatalogo = async () => {
        if (!window.confirm(`⚠️ ¿Estás COMPLETAMENTE SEGURO de eliminar todos los datos del catálogo de ${tab}? Esta acción no se puede deshacer.`)) return;

        try {
            await api.delete(`/catalogos/${tab}/limpiar`);
            cargarDatos();
            alert('🧹 Catálogo limpiado correctamente');
        } catch (err) {
            alert('Error al limpiar catálogo');
        }
    };

    if (cargando) return <div className="loading-container"><div className="spinner" /><p>Cargando catálogos...</p></div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primario)' }}>🗺️ Gestión de Catálogos</h1>
                    <p style={{ color: 'var(--color-texto-suave)', marginTop: 4 }}>Administración centralizada de responsables, enlaces y tipos de organismos</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-outline" onClick={descargarPlantilla}>📥 Bajar Plantilla</button>
                    <button className="btn btn-primary" onClick={() => setMostrandoModalCarga(true)}>🚀 Carga Masiva (Excel)</button>
                </div>
            </div>

            <div className="tabs">
                <button className={`tab-btn ${tab === 'dependencias' ? 'active' : ''}`} onClick={() => setTab('dependencias')}>🏢 Dependencias</button>
                <button className={`tab-btn ${tab === 'responsables' ? 'active' : ''}`} onClick={() => setTab('responsables')}>👨‍💼 Responsables</button>
                <button className={`tab-btn ${tab === 'enlaces' ? 'active' : ''}`} onClick={() => setTab('enlaces')}>📧 Enlaces</button>
                <button className={`tab-btn ${tab === 'avances' ? 'active' : ''}`} onClick={() => setTab('avances')}>📊 Avances</button>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <h3 className="card-title" style={{ fontSize: 16, marginBottom: 16 }}>➕ Agregar {tab.slice(0, -1)} individualmente</h3>
                <form onSubmit={handleIndividualSubmit} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
                        <label className="form-label">Nombre</label>
                        <input
                            type="text"
                            className="form-control"
                            value={formIndividual.nombre}
                            onChange={e => setFormIndividual({ ...formIndividual, nombre: e.target.value })}
                            required
                            placeholder={`Nombre de ${tab.slice(0, -1)}...`}
                        />
                    </div>
                    {tab === 'enlaces' && (
                        <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
                            <label className="form-label">Correo Electrónico</label>
                            <input
                                type="email"
                                className="form-control"
                                value={formIndividual.email}
                                onChange={e => setFormIndividual({ ...formIndividual, email: e.target.value })}
                                required
                                placeholder="ejemplo@correo.com"
                            />
                        </div>
                    )}
                    {tab === 'dependencias' && (
                        <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
                            <label className="form-label">Tipo de Organismo</label>
                            <select
                                className="form-control"
                                value={formIndividual.tipo}
                                onChange={e => setFormIndividual({ ...formIndividual, tipo: e.target.value })}
                            >
                                <option value="centralizada">🏢 Centralizada</option>
                                <option value="paraestatal">🏛️ Paraestatal</option>
                                <option value="organismo_autonomo">⚖️ Organismo Autónomo</option>
                            </select>
                        </div>
                    )}
                    <button type="submit" className="btn btn-primary" disabled={agregandoIndividual} style={{ height: 42 }}>
                        {agregandoIndividual ? '⏳...' : '✅ Agregar'}
                    </button>
                </form>
            </div>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 className="card-title">
                        {tab === 'responsables' ? `Responsables (${responsables.length})` :
                            tab === 'enlaces' ? `Enlaces (${enlaces.length})` :
                                tab === 'dependencias' ? `Dependencias (${dependencias.length})` :
                                    `Estados de Avance (${avances.length})`}
                    </h2>
                    <button className="btn btn-danger btn-sm" onClick={limpiarCatalogo}>🗑️ Limpiar Catálogo</button>
                </div>

                <div className="table-responsive">
                    <table>
                        <thead>
                            {tab === 'responsables' || tab === 'avances' ? (
                                <tr><th>Nombre</th><th>Estado</th><th>Fecha</th></tr>
                            ) : tab === 'enlaces' ? (
                                <tr><th>Nombre</th><th>Email</th><th>Estado</th><th>Fecha</th></tr>
                            ) : (
                                <tr><th>Nombre</th><th>Tipo</th><th>Estado</th><th>Fecha</th></tr>
                            )}
                        </thead>
                        <tbody>
                            {(tab === 'responsables' ? responsables :
                                tab === 'enlaces' ? enlaces :
                                    tab === 'dependencias' ? dependencias : avances).map(item => (
                                        <tr key={item.id}>
                                            <td><strong>{item.nombre}</strong></td>
                                            {tab === 'enlaces' && <td>{item.email}</td>}
                                            {tab === 'dependencias' && <td><span className="badge badge-normal">{item.tipo}</span></td>}
                                            <td><span className="badge badge-aprobado">Activo</span></td>
                                            <td>{new Date(item.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                            {(tab === 'responsables' ? responsables :
                                tab === 'enlaces' ? enlaces :
                                    tab === 'dependencias' ? dependencias : avances).length === 0 && (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No hay datos. Usa la carga masiva.</td></tr>
                                )}
                        </tbody>
                    </table>
                </div>
            </div>

            {mostrandoModalCarga && (
                <div className="modal-overlay" onClick={() => setMostrandoModalCarga(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">📤 Carga Masiva: {tab.toUpperCase()}</h2>
                            <button className="modal-close" onClick={() => setMostrandoModalCarga(false)}>×</button>
                        </div>

                        {!archivo ? (
                            <div className="dropzone">
                                <input type="file" id="fileInput" accept=".xlsx, .xls" onChange={handleFileUpload} style={{ display: 'none' }} />
                                <label htmlFor="fileInput" style={{ cursor: 'pointer' }}>
                                    <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
                                    <p>Haz clic para seleccionar o arrastra tu archivo Excel</p>
                                    <span style={{ fontSize: 12, color: '#999' }}>Solo archivos .xlsx o .xls</span>
                                </label>
                            </div>
                        ) : (
                            <div>
                                <div className="alert alert-info">
                                    Se detectaron <strong>{preview.length}</strong> registros en el archivo. Verifica la previsualización antes de guardar.
                                </div>
                                <div className="table-responsive" style={{ maxHeight: 300 }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                {tab === 'responsables' ? <th>Responsable</th> :
                                                    tab === 'enlaces' ? <><th>Nombre</th><th>Email</th></> :
                                                        tab === 'avances' ? <th>Estado de Avance</th> :
                                                            <><th>Dependencia</th><th>Tipo</th></>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.slice(0, 5).map((row, idx) => (
                                                <tr key={idx}>
                                                    {tab === 'responsables' ? <td>{row['Nombre del Responsable']}</td> :
                                                        tab === 'enlaces' ? <><td>{row['Nombre del Enlace']}</td><td>{row['Correo Electrónico']}</td></> :
                                                            tab === 'avances' ? <td>{row['Estado de Avance']}</td> :
                                                                <><td>{row['Nombre de Dependencia']}</td><td>{row['Tipo (centralizada, paraestatal, organismo_autonomo)']}</td></>}
                                                </tr>
                                            ))}
                                            {preview.length > 5 && <tr><td colSpan={2} style={{ textAlign: 'center' }}>... y {preview.length - 5} registros más</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                                    <button className="btn btn-outline" onClick={() => { setArchivo(null); setPreview([]); }}>Cambiar archivo</button>
                                    <button className="btn btn-primary" onClick={confirmCargaMasiva} disabled={procesando}>
                                        {procesando ? '⏳ Procesando...' : `✅ Cargar ${preview.length} registros`}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
