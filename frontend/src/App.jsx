import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Proyectos from './pages/Proyectos';
import ProyectoDetalle from './pages/ProyectoDetalle';
import Revisiones from './pages/Revisiones';
import Admin from './pages/Admin';
import Perfil from './pages/Perfil';

const RutaProtegida = ({ children, roles }) => {
    const { usuario, cargando } = useAuth();
    if (cargando) return <div className="loading-container"><div className="spinner" /></div>;
    if (!usuario) return <Navigate to="/login" replace />;
    if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />;
    return children;
};

const AppRoutes = () => {
    const { usuario } = useAuth();
    return (
        <Routes>
            <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/" element={
                <RutaProtegida>
                    <Layout />
                </RutaProtegida>
            }>
                <Route index element={<Dashboard />} />
                <Route path="proyectos" element={<Proyectos />} />
                <Route path="proyectos/:id" element={<ProyectoDetalle />} />
                <Route path="perfil" element={<Perfil />} />
                <Route path="revisiones" element={
                    <RutaProtegida roles={['admin', 'revisor']}>
                        <Revisiones />
                    </RutaProtegida>
                } />
                <Route path="admin" element={
                    <RutaProtegida roles={['admin']}>
                        <Admin />
                    </RutaProtegida>
                } />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthProvider>
    );
}
