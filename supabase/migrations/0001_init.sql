-- -----------------------------------------------------------------------------
-- 0001_init.sql
--
-- Descripción: Migración inicial para la base de datos de Alhambra Guide.
-- Define las tablas, relaciones, índices, RLS y funciones iniciales.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Tabla: profiles
-- Almacena datos públicos de los usuarios, incluyendo su rol.
-- -----------------------------------------------------------------------------
CREATE TABLE profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    role TEXT CHECK (role IN ('viewer', 'editor', 'admin')) DEFAULT 'viewer' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Tabla: guides
-- Contiene la información principal de cada guía.
-- -----------------------------------------------------------------------------
CREATE TABLE guides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    language TEXT NOT NULL,
    cover_url TEXT,
    status TEXT CHECK (status IN ('draft', 'published')) DEFAULT 'draft' NOT NULL,
    author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Tabla: guide_sections
-- Almacena las secciones de contenido de una guía, en orden.
-- -----------------------------------------------------------------------------
CREATE TABLE guide_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_id uuid REFERENCES guides(id) ON DELETE CASCADE NOT NULL,
    "order" INTEGER DEFAULT 0,
    title TEXT,
    body_md TEXT
);

-- -----------------------------------------------------------------------------
-- Tabla: tags
-- Define las etiquetas que se pueden asociar a las guías.
-- -----------------------------------------------------------------------------
CREATE TABLE tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL
);

-- -----------------------------------------------------------------------------
-- Tabla: guide_tags
-- Tabla de unión para la relación muchos a muchos entre guías y etiquetas.
-- -----------------------------------------------------------------------------
CREATE TABLE guide_tags (
    guide_id uuid REFERENCES guides(id) ON DELETE CASCADE,
    tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (guide_id, tag_id)
);

-- -----------------------------------------------------------------------------
-- Tabla: media
-- Almacena referencias a archivos multimedia asociados a una guía.
-- -----------------------------------------------------------------------------
CREATE TABLE media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_id uuid REFERENCES guides(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt TEXT,
    kind TEXT -- ej. 'image', 'video'
);

-- -----------------------------------------------------------------------------
-- Índices para mejorar el rendimiento de las consultas
-- -----------------------------------------------------------------------------
CREATE INDEX ON guides(slug);
CREATE INDEX ON guides(status, language, updated_at);
CREATE INDEX ON guide_sections(guide_id, "order");
CREATE INDEX ON tags(slug);

-- -----------------------------------------------------------------------------
-- Habilitar Row Level Security (RLS) en todas las tablas
-- -----------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Función auxiliar para obtener el rol de un usuario
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -----------------------------------------------------------------------------
-- Políticas de RLS para la tabla `profiles`
-- -----------------------------------------------------------------------------
-- Los usuarios pueden ver todos los perfiles (para mostrar nombres de autor, etc.)
CREATE POLICY "Allow public read access on profiles" ON profiles
FOR SELECT USING (true);

-- Los usuarios solo pueden actualizar su propio perfil.
CREATE POLICY "Allow individual update access on profiles" ON profiles
FOR UPDATE USING (auth.uid() = id);


-- -----------------------------------------------------------------------------
-- Políticas de RLS para la tabla `guides`
-- -----------------------------------------------------------------------------
-- Cualquiera (incluso anónimo) puede leer las guías publicadas.
CREATE POLICY "Allow public read access on published guides" ON guides
FOR SELECT USING (status = 'published');

-- Los usuarios autenticados pueden leer sus propios borradores.
CREATE POLICY "Allow author read access on draft guides" ON guides
FOR SELECT USING (auth.uid() = author_id);

-- Los editores/admins pueden leer TODAS las guías.
CREATE POLICY "Allow editor/admin read access on all guides" ON guides
FOR SELECT USING (get_user_role() IN ('editor', 'admin'));

-- Solo los editores/admins pueden crear nuevas guías.
CREATE POLICY "Allow insert for editors/admins on guides" ON guides
FOR INSERT WITH CHECK (get_user_role() IN ('editor', 'admin'));

-- Solo el autor original o un editor/admin puede actualizar una guía.
CREATE POLICY "Allow update for author or editors/admins on guides" ON guides
FOR UPDATE USING (auth.uid() = author_id OR get_user_role() IN ('editor', 'admin'));

-- Solo el autor original o un editor/admin puede eliminar una guía.
CREATE POLICY "Allow delete for author or editors/admins on guides" ON guides
FOR DELETE USING (auth.uid() = author_id OR get_user_role() IN ('editor', 'admin'));


-- -----------------------------------------------------------------------------
-- Políticas de RLS para `guide_sections`, `tags`, `guide_tags`, `media`
-- La lógica es similar: lectura pública si la guía está publicada, escritura
-- restringida a editores/admins.
-- -----------------------------------------------------------------------------

-- guide_sections
CREATE POLICY "Allow public read on sections of published guides" ON guide_sections
FOR SELECT USING (
  (SELECT status FROM guides WHERE id = guide_id) = 'published'
);
CREATE POLICY "Allow editor/admin full access on sections" ON guide_sections
FOR ALL USING (get_user_role() IN ('editor', 'admin'));

-- tags
CREATE POLICY "Allow public read access on tags" ON tags FOR SELECT USING (true);
CREATE POLICY "Allow editor/admin full access on tags" ON tags FOR ALL USING (get_user_role() IN ('editor', 'admin'));

-- guide_tags
CREATE POLICY "Allow public read on guide_tags of published guides" ON guide_tags
FOR SELECT USING (
  (SELECT status FROM guides WHERE id = guide_id) = 'published'
);
CREATE POLICY "Allow editor/admin full access on guide_tags" ON guide_tags
FOR ALL USING (get_user_role() IN ('editor', 'admin'));

-- media
CREATE POLICY "Allow public read on media of published guides" ON media
FOR SELECT USING (
  (SELECT status FROM guides WHERE id = guide_id) = 'published'
);
CREATE POLICY "Allow editor/admin full access on media" ON media
FOR ALL USING (get_user_role() IN ('editor', 'admin'));


-- -----------------------------------------------------------------------------
-- Trigger para crear un perfil de usuario al registrarse en `auth.users`
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'viewer');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- -----------------------------------------------------------------------------
-- Datos de ejemplo (Seeds)
-- -----------------------------------------------------------------------------
-- Opcional: Descomentar para insertar datos de prueba.
-- Asegúrate de que existe un usuario con el rol 'editor' para asignarlo como autor.

WITH editor AS (
  SELECT id FROM auth.users WHERE email = 'editor@example.com' LIMIT 1
),
new_guide AS (
  INSERT INTO guides (slug, title, summary, language, status, author_id, cover_url)
  VALUES ('alhambra-general', 'Guía Esencial de la Alhambra', 'Un recorrido completo por el monumento nazarí, desde la Alcazaba hasta los jardines del Generalife.', 'es', 'published', (SELECT id FROM editor), 'https://images.unsplash.com/photo-1589920038833-2457106fe3a2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80')
  RETURNING id
)
INSERT INTO guide_sections (guide_id, "order", title, body_md)
VALUES
  ((SELECT id FROM new_guide), 1, 'Introducción Histórica', 'La Alhambra, cuyo nombre significa "la fortaleza roja" en árabe, es un complejo palaciego y fortaleza que alojó a los monarcas de la dinastía nazarí del Reino de Granada. Su construcción comenzó en el siglo XIII y es uno de los máximos exponentes del arte andalusí.'),
  ((SELECT id FROM new_guide), 2, 'La Alcazaba', 'Es la zona más antigua del complejo, una fortaleza militar desde donde se pueden apreciar unas vistas espectaculares de la ciudad de Granada y Sierra Nevada. Pasea por la Plaza de Armas y sube a la Torre de la Vela.'),
  ((SELECT id FROM new_guide), 3, 'Palacios Nazaríes', 'El corazón de la Alhambra y la joya del arte nazarí. Se componen de tres palacios: el Mexuar, el Palacio de Comares (con su famoso Patio de los Arrayanes) y el Palacio de los Leones. Cada rincón está decorado con una increíble riqueza de detalles en yeserías, azulejos y mocárabes.'),
  ((SELECT id FROM new_guide), 4, 'El Generalife', 'La villa con jardines utilizada por los sultanes como lugar de retiro y descanso. Destacan el Patio de la Acequia y la Escalera del Agua, un ingenioso sistema que permitía que el agua fluyera por los pasamanos.');

-- -----------------------------------------------------------------------------
-- Políticas para el Almacenamiento (Storage)
-- Estas políticas deben crearse desde el panel de Supabase en Storage > Policies.
--
-- **Permitir lectura pública en el bucket `guides`:**
-- (Esta ya está configurada si el bucket se creó como público)
--
-- **Permitir subida de archivos solo a editores/admins:**
-- Target: guides
-- Operation: INSERT
-- Policy Definition: get_user_role() IN ('editor', 'admin')
--
-- **Permitir actualización/eliminación solo a editores/admins:**
-- Target: guides
-- Operation: UPDATE, DELETE
-- Policy Definition: get_user_role() IN ('editor', 'admin')
-- -----------------------------------------------------------------------------
