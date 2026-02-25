# 🏛️ Sistema de Atribuciones Jerárquicas

Sistema web para gestionar y relacionar atribuciones de unidades administrativas en estructuras jerárquicas gubernamentales. Permite la captura, validación y exportación al formato Excel institucional.

## 📋 Características

- 🌳 **Árbol de organigrama** interactivo con niveles jerárquicos
- 📝 **Atribuciones específicas** con relación padre-hijo y fundamento legal
- 📜 **Atribuciones generales** desde Ley/Decreto
- 🔍 **Flujo de revisiones** con observaciones y subsanaciones
- 📥 **Exportación a Excel** con hoja por unidad administrativa
- 📧 **Notificaciones por email** configurables
- 👥 **Roles**: Administrador, Dependencia, Revisor

## 🏗️ Estructura del Proyecto

```
sistema-atribuciones/
├── backend/          # Node.js + Express + PostgreSQL
│   ├── src/
│   │   ├── config/   # DB, schema.sql
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── services/ # Email, Excel
│   └── package.json
└── frontend/         # React + Vite
    ├── src/
    │   ├── context/
    │   ├── pages/
    │   ├── components/
    │   └── services/
    └── package.json
```

---

## 🚀 Guía de Despliegue en Render

### PASO 1: Crear repositorio en GitHub

1. Ve a [github.com](https://github.com) y crea una cuenta si no tienes
2. Haz clic en **"New repository"**
3. Nombre: `sistema-atribuciones` — Privado ✅ — Sin README
4. Haz clic en **"Create repository"**

### PASO 2: Subir el código a GitHub

En tu computadora, abre una terminal en la carpeta del proyecto:

```bash
# Navegar al proyecto
cd C:\Users\Alfredo Ochoa\.gemini\antigravity\scratch\sistema-atribuciones

# Inicializar Git
git init
git add .
git commit -m "🚀 Sistema de Atribuciones - versión inicial"

# Conectar con GitHub (reemplaza TU_USUARIO)
git remote add origin https://github.com/TU_USUARIO/sistema-atribuciones.git
git branch -M main
git push -u origin main
```

### PASO 3: Crear la base de datos en Render

1. Ve a [render.com](https://render.com) → **New +** → **PostgreSQL**
2. Nombre: `atribuciones-db`
3. Usuario: `atrib_user`
4. Plan: **Free**
5. Clic en **Create Database**
6. Copia el **"External Database URL"** (lo necesitarás después)

### PASO 4: Desplegar el Backend en Render

1. **New +** → **Web Service**
2. Conecta tu repositorio de GitHub
3. Configuración:
   - **Name**: `atribuciones-backend`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
   - **Plan**: Free
4. En **Environment Variables**, agrega:

   | Variable | Valor |
   |----------|-------|
   | `DATABASE_URL` | [URL de la BD que copiaste] |
   | `JWT_SECRET` | [una cadena aleatoria larga, ej: `mi-secreto-super-seguro-2025`] |
   | `NODE_ENV` | `production` |
   | `PORT` | `3001` |

5. Clic en **Create Web Service**
6. Espera a que termine el despliegue y copia la URL del backend, ej: `https://atribuciones-backend.onrender.com`

### PASO 5: Desplegar el Frontend en Render

1. **New +** → **Static Site**
2. Conecta el mismo repositorio
3. Configuración:
   - **Name**: `atribuciones-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. En **Environment Variables**, agrega:

   | Variable | Valor |
   |----------|-------|
   | `VITE_API_URL` | `https://atribuciones-backend.onrender.com` |

5. Clic en **Create Static Site**

### PASO 6: Ejecutar el esquema de BD (primera vez)

El backend **ejecuta automáticamente** el schema.sql al iniciar. Solo verifica en los logs del Web Service de Render que aparezca:

```
✅ Esquema de BD inicializado correctamente
🚀 Servidor corriendo en puerto 3001
```

### PASO 7: Primer acceso

Abre la URL del frontend en tu navegador. Las credenciales iniciales son:

> **Email**: `admin@atribuciones.gob`  
> **Contraseña**: `Admin123!`

⚠️ **Cambia la contraseña después del primer inicio de sesión.**

---

## 🔑 Variables de entorno del Backend

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `DATABASE_URL` | Connection string de PostgreSQL | ✅ |
| `JWT_SECRET` | Secreto para firmar tokens JWT | ✅ |
| `NODE_ENV` | `production` o `development` | ✅ |
| `PORT` | Puerto del servidor (por defecto 3001) | ❌ |
| `FRONTEND_URL` | URL del frontend para CORS | ❌ |

---

## 📖 Guía rápida de uso

### Para Administradores:
1. Ve a **Administración** → Crea dependencias (SEC, SCT, etc.)
2. Ve a **Administración** → Crea usuarios con rol Dependencia o Revisor
3. Crea un **Proyecto** y asígnalo a una dependencia
4. Dentro del proyecto: agrega unidades del organigrama
5. Configura el email SMTP para notificaciones

### Para Dependencias:
1. Abre tu proyecto asignado
2. Captura las **Atribuciones de Ley** (fundamento legal)
3. Selecciona cada unidad y agrega sus **Atribuciones Específicas**
4. Relaciona cada atribución con su fundamento de ley y nivel superior
5. Exporta el Excel cuando el revisor apruebe

### Para Revisores:
1. Ve al proyecto a revisar
2. Abre la pestaña **Revisiones** → Crea una nueva revisión
3. Emite observaciones específicas
4. La dependencia subsana y responde
5. Cierra la revisión cuando todo esté correcto

---

## 🛠️ Desarrollo local (requiere Node.js v18+)

```bash
# Backend
cd backend
npm install
# Crea un archivo .env con DATABASE_URL y JWT_SECRET
npm run dev

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
# Abre http://localhost:5173
```
