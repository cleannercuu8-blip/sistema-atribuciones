import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
    { to: '/', label: 'Reporte General', icon: '📊', roles: ['admin', 'revisor', 'visualizador'], exact: true },
    { to: '/proyectos', label: 'Proyectos', icon: '📁', roles: ['admin', 'revisor', 'visualizador', 'enlace'] },
    { to: '/revisiones', label: 'Revisiones', icon: '🔍', roles: ['admin', 'revisor', 'visualizador', 'enlace'] },
    { to: '/proyecto-word', label: 'Proyecto de Word', icon: '📝', roles: ['admin', 'revisor', 'visualizador'] },
    { to: '/carga-trabajo', label: 'Carga de Trabajo', icon: '⚖️', roles: ['admin', 'revisor', 'visualizador'] },
    { to: '/catalogos', label: 'Catálogos', icon: '📚', roles: ['admin', 'revisor'] },
    { to: '/admin', label: 'Administración', icon: '⚙️', roles: ['admin'] },
];

export default function Layout() {
    const { usuario, logout } = useAuth();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);

    const userInitials = usuario?.nombre?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '?';

    const getRolLabel = (rol) => {
        if (rol === 'admin') return 'Administrador';
        if (rol === 'revisor') return 'Revisor';
        if (rol === 'visualizador') return 'Visualizador';
        if (rol === 'enlace') return 'Enlace';
        return 'Usuario';
    };

    return (
        <div className={`layout ${isSidebarOpen ? 'sidebar-open' : ''}`}>
            {/* OVERLAY for Mobile */}
            {isSidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

            {/* SIDEBAR */}
            <aside className={`sidebar ${isSidebarOpen ? 'active' : ''}`}>
                <div className="sidebar-logo">
                    <span className="logo-icon">🌳</span>
                    <div>
                        <h1>Árbol de Atribuciones</h1>
                        <p>Plataforma de Gestión</p>
                    </div>
                    {/* Botón para cerrar en móvil dentro del sidebar opcional */}
                    <button className="sidebar-close-btn mobile-only" onClick={closeSidebar}>✕</button>
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
                                onClick={closeSidebar}
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
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', lineHeight: 1.2 }}>{usuario?.nombre}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {getRolLabel(usuario?.rol)}
                                <NavLink to="/perfil" className="sidebar-perfil-link" title="Ir a mi perfil" onClick={closeSidebar}>👤 Perfil</NavLink>
                            </div>
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
                {/* Mobile Topbar for Toggle */}
                <div className="mobile-topbar">
                    <button className="menu-toggle-btn" onClick={toggleSidebar}>
                        ☰
                    </button>
                    <div className="mobile-logo-text">🌳 Árbol de Atribuciones</div>
                    <div className="user-avatar-sm">{userInitials}</div>
                </div>

                <div className="page-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
