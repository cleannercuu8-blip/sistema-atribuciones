import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [usuario, setUsuario] = useState(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const usuarioGuardado = localStorage.getItem('usuario');

        if (token && usuarioGuardado && usuarioGuardado !== 'undefined' && usuarioGuardado !== 'null') {
            try {
                const parsed = JSON.parse(usuarioGuardado);
                if (parsed && typeof parsed === 'object') {
                    setUsuario(parsed);
                } else {
                    localStorage.removeItem('token');
                    localStorage.removeItem('usuario');
                }
            } catch (err) {
                console.error("Sesión corrupta detectada, limpiando...", err);
                localStorage.removeItem('usuario');
                localStorage.removeItem('token');
            }
        }
        setCargando(false);
    }, []);

    const login = async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('usuario', JSON.stringify(res.data.usuario));
        setUsuario(res.data.usuario);
        return res.data.usuario;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        setUsuario(null);
    };

    return (
        <AuthContext.Provider value={{ usuario, login, logout, cargando }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
