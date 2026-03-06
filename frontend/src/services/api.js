import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';
console.log('🌐 API Base URL:', API_URL);

const api = axios.create({
    baseURL: `${API_URL}/api`,
    headers: { 'Content-Type': 'application/json' }
});

// Agregar token a todas las solicitudes
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    console.log(`🚀 Llamando a API: ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
});

// Manejar respuestas de error
api.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('usuario');
            window.location.href = '/login';
        }

        console.error('❌ Error de API:', {
            url: err.config?.url,
            status: err.response?.status,
            data: err.response?.data,
            message: err.message
        });

        return Promise.reject(err);
    }
);

export default api;
