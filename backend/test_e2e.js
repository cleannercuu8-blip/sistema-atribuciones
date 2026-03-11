const axios = require('axios');

const API_URL = 'https://atribuciones-backend.onrender.com/api';

async function runTests() {
    try {
        console.log('--- Iniciando Pruebas E2E del Backend ---');

        // 1. Login
        console.log('\n1. Probando Login...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@atribuciones.gob',
            password: '123456'
        });
        const token = loginRes.data.token;
        console.log('✅ Login exitoso. Token obtenido.');

        const config = {
            headers: { Authorization: `Bearer ${token}` }
        };

        // 1.5 Obtener dependencias y estados para usar IDs válidos
        const depRes = await axios.get(`${API_URL}/dependencias`, config).catch(() => ({ data: [{ id: 1 }] }));
        const estRes = await axios.get(`${API_URL}/proyectos/estados`, config).catch(() => ({ data: [{ id: 1 }] }));
        const depId = depRes.data.length > 0 ? depRes.data[0].id : 1;
        const estId = estRes.data.length > 0 ? estRes.data[0].id : 1;

        // 2. Crear Proyecto
        console.log('\n2. Probando Creación de Proyecto...');
        console.log(`Usando dependencia_id: ${depId}, estado_id: ${estId}`);
        const createRes = await axios.post(`${API_URL}/proyectos`, {
            nombre: 'Proyecto de Prueba Automatizada Completa',
            dependencia_id: depId,
            estado_id: estId,
            responsable: 'Admin Test',
            responsable_apoyo: '',
            enlaces: '',
            fecha_expediente: ''
        }, config);
        const proyectoId = createRes.data.id;
        console.log(`✅ Proyecto creado exitosamente. ID: ${proyectoId}`);

        // 3. Listar Proyectos
        console.log('\n3. Probando Listado de Proyectos...');
        const listRes = await axios.get(`${API_URL}/proyectos`, config);
        const proyectos = listRes.data;
        console.log(`✅ Listado exitoso. Total de proyectos: ${proyectos.length}`);
        const found = proyectos.find(p => p.id === proyectoId);
        if (found) {
            console.log('✅ El proyecto recién creado aparece en el listado.');
        } else {
            console.log('❌ El proyecto recién creado NO aparece en el listado.');
        }

        // 4. Eliminar Proyecto
        console.log(`\n4. Probando Eliminación de Proyecto (ID: ${proyectoId})...`);
        await axios.delete(`${API_URL}/proyectos/${proyectoId}`, config);
        console.log('✅ Proyecto eliminado exitosamente.');

        // 5. Verificar Eliminación
        const listRes2 = await axios.get(`${API_URL}/proyectos`, config);
        const foundDeleted = listRes2.data.find(p => p.id === proyectoId);
        if (!foundDeleted) {
            console.log('✅ Verificación exitosa: El proyecto ya no existe en la base de datos.');
        } else {
            console.log('❌ Verificación fallida: El proyecto sigue existiendo.');
        }

        console.log('\n--- Todas las pruebas pasaron exitosamente ---');

    } catch (error) {
        console.error('\n❌ ERROR EN LAS PRUEBAS:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

runTests();
