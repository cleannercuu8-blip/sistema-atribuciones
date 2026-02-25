-- =============================================
-- SCHEMA: Sistema de Atribuciones Jerárquicas
-- =============================================

-- EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- TIPOS ENUMERADOS
CREATE TYPE rol_usuario AS ENUM ('admin', 'dependencia', 'revisor');
CREATE TYPE tipo_dependencia AS ENUM ('centralizada', 'paraestatal', 'organismo_autonomo', 'otro');
CREATE TYPE estado_proyecto AS ENUM ('borrador', 'en_revision', 'aprobado');
CREATE TYPE estado_revision AS ENUM ('abierta', 'cerrada');
CREATE TYPE estado_observacion AS ENUM ('pendiente', 'subsanada');
CREATE TYPE tipo_atribucion AS ENUM ('normal', 'indelegable');
CREATE TYPE rol_proyecto AS ENUM ('lider', 'ayudante');

-- =============================================
-- USUARIOS
-- =============================================
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol rol_usuario NOT NULL DEFAULT 'dependencia',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DEPENDENCIAS
-- =============================================
CREATE TABLE dependencias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(300) NOT NULL UNIQUE,
  siglas VARCHAR(50),
  tipo tipo_dependencia NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PROYECTOS
-- =============================================
CREATE TABLE proyectos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(300) NOT NULL,
  dependencia_id INTEGER NOT NULL REFERENCES dependencias(id),
  estado estado_proyecto DEFAULT 'borrador',
  organigrama_url TEXT,  -- URL del PDF subido a Render
  created_by INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuarios de dependencia asignados a un proyecto
CREATE TABLE proyecto_usuarios (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_en_proyecto rol_proyecto DEFAULT 'ayudante',
  UNIQUE(proyecto_id, usuario_id)
);

-- Revisores asignados a un proyecto
CREATE TABLE proyecto_revisores (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  es_lider BOOLEAN DEFAULT false,
  UNIQUE(proyecto_id, usuario_id)
);

-- =============================================
-- ORGANIGRAMA: Unidades Administrativas del árbol
-- =============================================
CREATE TABLE unidades_administrativas (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre VARCHAR(300) NOT NULL,
  siglas VARCHAR(50) NOT NULL,
  nivel_numero INTEGER NOT NULL,  -- 0=Ley base, 1=Titular, 2=SubDir/Coord, etc.
  padre_id INTEGER REFERENCES unidades_administrativas(id),  -- NULL = raíz
  orden INTEGER DEFAULT 0,  -- para ordenar hermanos de izq a der
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proyecto_id, siglas)  -- siglas únicas por proyecto
);

-- =============================================
-- ATRIBUCIONES GENERALES (Ley / Decreto base)
-- =============================================
CREATE TABLE atribuciones_generales (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  clave VARCHAR(20) NOT NULL,  -- S01, S02, ...
  norma VARCHAR(100),          -- LOPF, Reglamento, etc.
  articulo VARCHAR(50),
  fraccion_parrafo VARCHAR(100),
  texto TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ATRIBUCIONES ESPECÍFICAS (por unidad/nivel)
-- =============================================
CREATE TABLE atribuciones_especificas (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  unidad_id INTEGER NOT NULL REFERENCES unidades_administrativas(id) ON DELETE CASCADE,
  clave VARCHAR(30) NOT NULL,   -- PTR01, SA01, SAdm01, ...
  texto TEXT NOT NULL,
  tipo tipo_atribucion DEFAULT 'normal',
  -- Relación con la atribución del nivel superior
  padre_atribucion_id INTEGER REFERENCES atribuciones_especificas(id),
  -- Relación con la atribución general de ley (si aplica)
  atribucion_general_id INTEGER REFERENCES atribuciones_generales(id),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- GLOSARIO
-- =============================================
CREATE TABLE glosario (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  acronimo VARCHAR(50) NOT NULL,
  significado TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- REVISIONES Y OBSERVACIONES
-- =============================================
CREATE TABLE revisiones (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  numero_revision INTEGER NOT NULL,
  revisor_id INTEGER NOT NULL REFERENCES usuarios(id),
  dias_habiles_plazo INTEGER DEFAULT 10,
  fecha_inicio TIMESTAMPTZ DEFAULT NOW(),
  fecha_limite TIMESTAMPTZ,
  fecha_cierre TIMESTAMPTZ,
  estado estado_revision DEFAULT 'abierta',
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE observaciones (
  id SERIAL PRIMARY KEY,
  revision_id INTEGER NOT NULL REFERENCES revisiones(id) ON DELETE CASCADE,
  atribucion_especifica_id INTEGER REFERENCES atribuciones_especificas(id),
  unidad_id INTEGER REFERENCES unidades_administrativas(id),
  texto_observacion TEXT NOT NULL,
  estado estado_observacion DEFAULT 'pendiente',
  respuesta TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CONFIGURACIÓN EMAIL (admin)
-- =============================================
CREATE TABLE configuracion_email (
  id SERIAL PRIMARY KEY,
  smtp_host VARCHAR(200),
  smtp_port INTEGER DEFAULT 587,
  smtp_user VARCHAR(200),
  smtp_pass VARCHAR(500),
  from_name VARCHAR(200) DEFAULT 'Sistema de Atribuciones',
  activo BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX idx_proyectos_dependencia ON proyectos(dependencia_id);
CREATE INDEX idx_unidades_proyecto ON unidades_administrativas(proyecto_id);
CREATE INDEX idx_unidades_padre ON unidades_administrativas(padre_id);
CREATE INDEX idx_atr_esp_proyecto ON atribuciones_especificas(proyecto_id);
CREATE INDEX idx_atr_esp_unidad ON atribuciones_especificas(unidad_id);
CREATE INDEX idx_atr_esp_padre ON atribuciones_especificas(padre_atribucion_id);
CREATE INDEX idx_revisiones_proyecto ON revisiones(proyecto_id);
CREATE INDEX idx_observaciones_revision ON observaciones(revision_id);

INSERT INTO usuarios (nombre, email, password_hash, rol)
VALUES (
  'Administrador',
  'admin@atribuciones.gob',
  '$2a$10$hFAJig5vwXGk/yzTUAnwpeJhWVQPDv.0Abi6je12CFF9JRgiGTOm.',
  'admin'
);
