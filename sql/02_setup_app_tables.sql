-- 02_setup_app_tables.sql

-- Helper function to get the business ID of the currently logged-in user.
-- It reads it from the `negocio_id` column in the user's profile.
CREATE OR REPLACE FUNCTION auth.get_current_negocio_id()
RETURNS UUID AS $$
DECLARE
  negocio_id_val UUID;
BEGIN
  SELECT negocio_id INTO negocio_id_val FROM public.profiles WHERE id = auth.uid();
  RETURN negocio_id_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1. Tabla de Turnos
-- Almacena cada turno solicitado por un cliente.
CREATE TABLE public.turnos (
  id BIGSERIAL PRIMARY KEY,
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  turno TEXT, -- ej. "A01", "B02"
  nombre_cliente TEXT,
  telefono TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'En espera', -- 'En espera', 'En atención', 'Atendido', 'Cancelado', 'No presentado'
  orden INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);
COMMENT ON TABLE public.turnos IS 'Stores each appointment requested by a customer.';

-- Indices
CREATE INDEX ON public.turnos(negocio_id, fecha);
CREATE INDEX ON public.turnos(negocio_id, estado);

-- RLS para Turnos
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Los usuarios pueden gestionar los turnos de su negocio" ON public.turnos
  FOR ALL USING (negocio_id = auth.get_current_negocio_id());


-- 2. Tabla de Servicios
-- Catálogo de servicios ofrecidos por cada negocio.
CREATE TABLE public.servicios (
  id BIGSERIAL PRIMARY KEY,
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  duracion_min INTEGER NOT NULL DEFAULT 25,
  precio NUMERIC NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(negocio_id, nombre)
);
COMMENT ON TABLE public.servicios IS 'Catalog of services offered by each business.';

-- RLS para Servicios
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Los usuarios pueden gestionar los servicios de su negocio" ON public.servicios
  FOR ALL USING (negocio_id = auth.get_current_negocio_id());


-- 3. Tabla de Cierres de Caja
-- Almacena un resumen diario de la actividad del negocio.
CREATE TABLE public.cierres_caja (
  id BIGSERIAL PRIMARY KEY,
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  cerrado_en TIMESTAMPTZ DEFAULT NOW(),
  total_turnos INTEGER DEFAULT 0,
  ingresos_total NUMERIC DEFAULT 0,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(negocio_id, fecha)
);
COMMENT ON TABLE public.cierres_caja IS 'Stores a daily summary of business activity.';

-- RLS para Cierres de Caja
ALTER TABLE public.cierres_caja ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Los usuarios pueden gestionar los cierres de su negocio" ON public.cierres_caja
  FOR ALL USING (negocio_id = auth.get_current_negocio_id());


-- 4. Tabla de Configuración del Negocio
-- Almacena configuraciones específicas para cada negocio.
CREATE TABLE public.negocio_configuracion (
  id BIGSERIAL PRIMARY KEY,
  negocio_id UUID NOT NULL UNIQUE REFERENCES public.negocios(id) ON DELETE CASCADE,
  hora_apertura TIME NOT NULL DEFAULT '09:00:00',
  hora_cierre TIME NOT NULL DEFAULT '18:00:00',
  limite_turnos INTEGER NOT NULL DEFAULT 50,
  dias_operacion TEXT[] DEFAULT ARRAY['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.negocio_configuracion IS 'Stores business-specific settings.';

-- RLS para Configuración del Negocio
ALTER TABLE public.negocio_configuracion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Los usuarios pueden gestionar la configuración de su negocio" ON public.negocio_configuracion
  FOR ALL USING (negocio_id = auth.get_current_negocio_id());
