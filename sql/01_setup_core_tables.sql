-- 01_setup_core_tables.sql

-- 1. Tabla de Negocios
-- Almacena la información de cada negocio/barbería.
CREATE TABLE public.negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.negocios IS 'Stores information about each business.';

-- 2. Tabla de Perfiles de Usuario
-- Almacena datos adicionales del usuario y lo vincula a un negocio.
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  negocio_id UUID REFERENCES public.negocios(id) ON DELETE SET NULL,
  full_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.profiles IS 'Stores user profile information and links them to a business.';
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Función para Crear un Perfil Automáticamente
-- Se activa cada vez que un nuevo usuario se registra en Supabase Auth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger para la Función
-- Llama a la función handle_new_user() cuando se inserta un nuevo usuario.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Políticas de Seguridad para Perfiles
-- Los usuarios pueden ver su propio perfil.
CREATE POLICY "Users can view their own profile." ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil.
CREATE POLICY "Users can update their own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
