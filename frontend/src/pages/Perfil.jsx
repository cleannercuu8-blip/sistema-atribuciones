import React, { useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Perfil() {
    const { usuario } = useAuth();
    const [form, setForm] = useState({ password_actual: '', password_nuevo: '', confirmar: '' });
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [cargando, setCargando] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password_nuevo !== form.confirmar) {
            return setMsg({ type: 'error', text: 'Las nuevas contraseñas no coinciden' });
        }
        setCargando(true);
        try {
            await api.put('/auth/cambiar-password', {
                password_actual: form.password_actual,
                password_nuevo: form.password_nuevo
            });
            setMsg({ type: 'success', text: '✅ Contraseña actualizada correctamente' });
            setForm({ password_actual: '', password_nuevo: '', confirmar: '' });
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Error al cambiar contraseña' });
        }
        setCargando(false);
    };

    return (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primario)' }}>👤 Mi Perfil</h1>
                <p style={{ color: 'var(--color-texto-suave)' }}>Gestiona tu información personal y seguridad</p>
            </div>

            <div className="card">
                <div className="card-header">
                    <span className="card-title">🔐 Seguridad: Cambiar Contraseña</span>
                </div>

                {msg.text && (
                    <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 20 }}>
                        {msg.text}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Contraseña actual</label>
                        <input
                            type="password"
                            className="form-control"
                            value={form.password_actual}
                            onChange={e => setForm({ ...form, password_actual: e.target.value })}
                            required
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Nueva contraseña</label>
                            <input
                                type="password"
                                className="form-control"
                                value={form.password_nuevo}
                                onChange={e => setForm({ ...form, password_nuevo: e.target.value })}
                                required
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirmar nueva contraseña</label>
                            <input
                                type="password"
                                className="form-control"
                                value={form.confirmar}
                                onChange={e => setForm({ ...form, confirmar: e.target.value })}
                                required
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <button type="submit" className="btn btn-primary" disabled={cargando}>
                            {cargando ? '⏳ Procesando...' : '💾 Actualizar contraseña'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header">
                    <span className="card-title">📌 Información de Usuario</span>
                </div>
                <div style={{ padding: '10px 0' }}>
                    <p style={{ margin: '8px 0', fontSize: 14 }}><strong>Nombre:</strong> {usuario?.nombre}</p>
                    <p style={{ margin: '8px 0', fontSize: 14 }}><strong>Correo:</strong> {usuario?.email}</p>
                    <p style={{ margin: '8px 0', fontSize: 14 }}><strong>Rol:</strong> <span className={`badge badge-${usuario?.rol}`}>{usuario?.rol}</span></p>
                </div>
            </div>
        </div>
    );
}
