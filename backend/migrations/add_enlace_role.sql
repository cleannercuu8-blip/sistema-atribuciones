-- Migración: Agregar rol 'enlace' al ENUM rol_usuario
-- Ejecutar en la base de datos de Neon si el rol no existe

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'enlace'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'rol_usuario')
    ) THEN
        ALTER TYPE rol_usuario ADD VALUE 'enlace';
    END IF;
END $$;
