import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setCargando(true);
        try {
            console.log('📝 Intentando ingresar con:', email);
            await login(email, password);
            navigate('/');
        } catch (err) {
            console.error('❌ Error capturado en Login:', err);
            console.error('🔍 Detalle del error:', err.response?.data);
            setError(err.response?.data?.error || 'Error de conexión con el servidor (404)');
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-logo">
                    <div className="logo-emoji">🌳</div>
                    <h1>Sistema para Árbol<br />de Atribuciones</h1>
                    <p>Ingrese sus credenciales para acceder</p>
                </div>

                {error && (
                    <div className="alert alert-error">
                        <span>⚠️</span> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Correo electrónico <span className="required">*</span></label>
                        <input
                            type="email"
                            className="form-control"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="usuario@correo.com"
                            required
                            id="input-email"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Contraseña <span className="required">*</span></label>
                        <input
                            type="password"
                            className="form-control"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            id="input-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={cargando}
                        style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '15px', marginTop: 8 }}
                        id="btn-login"
                    >
                        {cargando ? '⏳ Ingresando...' : '🔐 Ingresar al sistema'}
                    </button>
                </form>

                <div style={{ marginTop: 24, padding: 16, background: '#f8faff', borderRadius: 8, fontSize: 12, color: '#6c7c8e', textAlign: 'center' }}>
                    <strong>Acceso inicial:</strong><br />
                    admin@atribuciones.gob / Admin123!<br />
                    <em>(Cambie la contraseña después del primer acceso)</em>
                </div>
            </div>
        </div>
    );
}
