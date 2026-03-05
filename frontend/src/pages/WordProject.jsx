import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function WordProject() {
    const [proyectos, setProyectos] = useState([]);
    const [proyectoId, setProyectoId] = useState('');
    const [cargando, setCargando] = useState(false);
    const [cargandoProyectos, setCargandoProyectos] = useState(true);

    useEffect(() => {
        api.get('/proyectos')
            .then(res => {
                setProyectos(res.data);
                setCargandoProyectos(false);
            })
            .catch(err => {
                console.error('Error al cargar proyectos:', err);
                setCargandoProyectos(false);
            });
    }, []);

    const handleGenerarWord = async () => {
        if (!proyectoId) {
            alert('Por favor selecciona un proyecto');
            return;
        }

        setCargando(true);
        try {
            const res = await api.get(`/proyectos/${proyectoId}/exportar-word`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            const proyecto = proyectos.find(p => p.id === parseInt(proyectoId));
            const nombreArchivo = `Proyecto-Word-${proyecto?.nombre || 'documento'}.docx`;
            link.setAttribute('download', nombreArchivo);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error('Error al generar Word:', err);
            alert('Aún no se ha implementado el endpoint de exportación a Word o hubo un error.');
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-primario)', marginBottom: 8 }}>
                    📝 Proyecto de Word
                </h1>
                <p style={{ color: 'var(--color-texto-suave)', fontSize: 13 }}>
                    Genera el documento final de Word con las atribuciones de cada unidad administrativa.
                    Este proceso utiliza la estructura final validada del proyecto.
                </p>
            </div>

            <div className="card" style={{ maxWidth: 600 }}>
                <div className="card-header">
                    <span className="card-title">📄 Generar Documento</span>
                </div>
                <div style={{ padding: 20 }}>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
                            Seleccionar Proyecto
                        </label>
                        {cargandoProyectos ? (
                            <div className="skeleton" style={{ height: 40, width: '100%' }}></div>
                        ) : (
                            <select
                                className="form-control"
                                value={proyectoId}
                                onChange={(e) => setProyectoId(e.target.value)}
                            >
                                <option value="">-- Selecciona un proyecto --</option>
                                {proyectos.map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre} ({p.dependencia_nombre})</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 20, border: '1px solid #e2e8f0' }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#475569' }}>💡 Información</h4>
                        <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                            El documento generado incluirá todos los glosarios, leyes y el desglose de atribuciones
                            por unidad administrativa siguiendo el formato oficial.
                        </p>
                    </div>

                    <button
                        className="btn btn-primary"
                        style={{ width: '100%', height: 48, fontSize: 15 }}
                        onClick={handleGenerarWord}
                        disabled={cargando || !proyectoId}
                    >
                        {cargando ? '⌛ Generando documento...' : '📥 Descargar Proyecto en Word'}
                    </button>
                </div>
            </div>
        </div>
    );
}
