import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
    { to: '/', label: 'Reporte General', icon: '📊', roles: ['admin', 'dependencia', 'revisor'], exact: true },
    { to: '/proyectos', label: 'Proyectos', icon: '📁', roles: ['admin', 'dependencia', 'revisor'] },
    { to: '/revisiones', label: 'Revisiones', icon: '🔍', roles: ['admin', 'revisor'] },
    { to: '/perfil', label: 'Mi Perfil', icon: '👤', roles: ['admin', 'dependencia', 'revisor'] },
    { to: '/admin', label: 'Administración', icon: '⚙️', roles: ['admin'] },
];

export default function Layout() {
    const { usuario, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const userInitials = usuario?.nombre?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '?';

    const getRolLabel = (rol) => {
        if (rol === 'admin') return 'Administrador';
        if (rol === 'revisor') return 'Revisor';
        return 'Dependencia';
    };

    return (
        <div className="layout">
            {/* SIDEBAR */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <span className="logo-icon">🌳</span>
                    <div>
                        <h1>Árbol de Atribuciones</h1>
                        <p>Plataforma de Gestión</p>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section-title">Menú principal</div>
                    {navItems
                        .filter(item => item.roles.includes(usuario?.rol))
                        .map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.exact}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                {item.label}
                            </NavLink>
                        ))
                    }
                </nav>

                <div className="sidebar-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', marginBottom: 8 }}>
                        <div className="user-avatar">{userInitials}</div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', lineHeight: 1.2 }}>{usuario?.nombre}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{getRolLabel(usuario?.rol)}</div>
                        </div>
                    </div>
                    <button className="nav-item" onClick={handleLogout} style={{ color: '#ff8a8a' }}>
                        <span className="nav-icon">🚪</span>
                        Cerrar sesión
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="main-content">
                <div className="page-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
