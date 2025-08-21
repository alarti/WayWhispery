-- -----------------------------------------------------------------------------
-- 0001_init.sql
--
-- Descripción: Migración inicial para la base de datos de WayWhispery.
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
    details JSONB, -- Contains title, summary, etc. in multiple languages
    default_lang TEXT NOT NULL DEFAULT 'en',
    available_langs TEXT[] NOT NULL DEFAULT '{"en"}',
    cover_url TEXT,
    status TEXT CHECK (status IN ('draft', 'published')) DEFAULT 'draft' NOT NULL,
    author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    rating INT DEFAULT 0,
    rating_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    initial_lat DOUBLE PRECISION,
    initial_lon DOUBLE PRECISION,
    initial_zoom INTEGER
);


-- -----------------------------------------------------------------------------
-- Tabla: guide_poi
-- Almacena los Puntos de Interés (POIs) de una guía, en orden.
-- -----------------------------------------------------------------------------
CREATE TABLE guide_poi (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_id uuid REFERENCES guides(id) ON DELETE CASCADE NOT NULL,
    "order" INTEGER DEFAULT 0,
    texts JSONB, -- Contains title and description in multiple languages
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION
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
CREATE INDEX ON guide_poi(guide_id, "order");
CREATE INDEX ON tags(slug);

-- -----------------------------------------------------------------------------
-- Habilitar Row Level Security (RLS) en todas las tablas
-- -----------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_poi ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY "Allow public read access on profiles" ON profiles
FOR SELECT USING (true);

CREATE POLICY "Allow individual update access on profiles" ON profiles
FOR UPDATE USING (auth.uid() = id);


-- -----------------------------------------------------------------------------
-- Políticas de RLS para la tabla `guides`
-- -----------------------------------------------------------------------------
CREATE POLICY "Allow public read access on published guides" ON guides
FOR SELECT USING (status = 'published');

CREATE POLICY "Allow author read access on draft guides" ON guides
FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Allow editor/admin read access on all guides" ON guides
FOR SELECT USING (get_user_role() IN ('editor', 'admin'));

CREATE POLICY "Allow insert for editors/admins on guides" ON guides
FOR INSERT WITH CHECK (get_user_role() IN ('editor', 'admin'));

CREATE POLICY "Allow update for author or editors/admins on guides" ON guides
FOR UPDATE USING (auth.uid() = author_id OR get_user_role() IN ('editor', 'admin'));

CREATE POLICY "Allow delete for author or editors/admins on guides" ON guides
FOR DELETE USING (auth.uid() = author_id OR get_user_role() IN ('editor', 'admin'));


-- -----------------------------------------------------------------------------
-- Políticas de RLS para `guide_poi`, `tags`, `guide_tags`, `media`
-- -----------------------------------------------------------------------------

-- guide_poi
CREATE POLICY "Allow public read on POIs of published guides" ON guide_poi
FOR SELECT USING (
  (SELECT status FROM guides WHERE id = guide_id) = 'published'
);

CREATE POLICY "Allow full access for editors/admins on POIs" ON guide_poi
FOR ALL USING (
    (get_user_role() IN ('editor', 'admin')) OR
    (auth.uid() = (SELECT author_id FROM guides WHERE id = guide_id))
) WITH CHECK (
    (get_user_role() IN ('editor', 'admin')) OR
    (auth.uid() = (SELECT author_id FROM guides WHERE id = guide_id))
);

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
  VALUES (new.id, new.email, 'editor');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- -----------------------------------------------------------------------------
-- Datos de ejemplo (Seeds)
-- -----------------------------------------------------------------------------
-- Inserta un usuario editor si no existe para poder asignarlo como autor.
-- En un entorno real, esto se haría manualmente.
INSERT INTO auth.users (id, email, encrypted_password, role)
VALUES ('8a79a739-3175-4de3-b261-39583b27a28e', 'editor@example.com', crypt('password', gen_salt('bf')), 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, role)
VALUES ('8a79a739-3175-4de3-b261-39583b27a28e', 'editor@example.com', 'editor')
ON CONFLICT (id) DO NOTHING;


-- Creación de la guía de la Alhambra con todos sus POIs
WITH editor AS (
  SELECT id FROM profiles WHERE email = 'editor@example.com' LIMIT 1
),
new_guide AS (
  INSERT INTO guides (slug, details, default_lang, available_langs, status, author_id, cover_url, initial_lat, initial_lon, initial_zoom)
  VALUES
    ('alhambra-general',
     '{"en": {"title": "Essential Alhambra Guide", "summary": "A complete tour of the Nasrid monument, from the Alcazaba to the Generalife gardens."}}',
     'en',
     '{"en"}',
     'published',
     (SELECT id FROM editor),
     'https://images.unsplash.com/photo-1589920038833-2457106fe3a2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80',
     37.1773, -3.5986, 15)
  ON CONFLICT (slug) DO UPDATE SET
    details = EXCLUDED.details
  RETURNING id
)
INSERT INTO guide_poi (guide_id, "order", texts, lat, lon)
VALUES
  ((SELECT id FROM new_guide), 1, '{"en": {"title": "Gate of the Pomegranates", "description": "Classic ascent from Plaza Nueva to the monumental Gate of the Pomegranates."}}', 37.1745, -3.5936),
  ((SELECT id FROM new_guide), 2, '{"en": {"title": "Alhambra Forest", "description": "Historic forest planted in the time of Charles V."}}', 37.1755, -3.5920),
  ((SELECT id FROM new_guide), 3, '{"en": {"title": "Gate of Justice", "description": "Monumental entrance with bent archway, a hand of Fatima and a key."}}', 37.1760, -3.5907),
  ((SELECT id FROM new_guide), 4, '{"en": {"title": "Pillar of Charles V", "description": "Renaissance fountain from 1554 with three faces and several spouts."}}', 37.1762, -3.5905),
  ((SELECT id FROM new_guide), 5, '{"en": {"title": "Palace of Charles V", "description": "Renaissance imperial palace with a monumental circular courtyard."}}', 37.1767, -3.5900),
  ((SELECT id FROM new_guide), 6, '{"en": {"title": "Court of the Myrtles (Comares)", "description": "Water mirror between myrtle hedges reflecting the Comares Tower."}}', 37.1773, -3.5896),
  ((SELECT id FROM new_guide), 7, '{"en": {"title": "Court of the Lions", "description": "The heart of the Nasrid palaces, celebrated for its central fountain."}}', 37.1773, -3.5890),
  ((SELECT id FROM new_guide), 8, '{"en": {"title": "Hall of the Abencerrajes", "description": "A legendary room with a star-shaped muqarnas dome."}}', 37.1771, -3.5890),
  ((SELECT id FROM new_guide), 9, '{"en": {"title": "Royal Baths (Nasrid Hammam)", "description": "Bath complex with cold, warm, and hot rooms."}}', 37.1776, -3.5898),
  ((SELECT id FROM new_guide), 10, '{"en": {"title": "Water Channels of the Court of the Lions", "description": "Network of shallow channels in four axes radiating from the fountain."}}', 37.1774, -3.5891),
  ((SELECT id FROM new_guide), 11, '{"en": {"title": "Partal Gardens and Paths", "description": "Avenues of myrtle hedges, viewpoints, and small ponds."}}', 37.1780, -3.5880),
  ((SELECT id FROM new_guide), 12, '{"en": {"title": "Partal Palace", "description": "Palatial complex with a portico reflected in a large pond."}}', 37.1782, -3.5885),
  ((SELECT id FROM new_guide), 13, '{"en": {"title": "Alhambra Museum", "description": "Collection of Nasrid artifacts and original pieces."}}', 37.1768, -3.5901),
  ((SELECT id FROM new_guide), 14, '{"en": {"title": "Alhambra Medina", "description": "Excavated area that housed noble residences and artisan workshops."}}', 37.1765, -3.5885),
  ((SELECT id FROM new_guide), 15, '{"en": {"title": "Alcazaba", "description": "The oldest sector, a military citadel with watchtowers and views."}}', 37.1772, -3.5925),
  ((SELECT id FROM new_guide), 16, '{"en": {"title": "Gate of Arms", "description": "Original military access on the Darro slope."}}', 37.1780, -3.5930),
  ((SELECT id FROM new_guide), 17, '{"en": {"title": "Gate of the Seven Floors", "description": "Gate on the southern wall with late bastions."}}', 37.1750, -3.5895),
  ((SELECT id FROM new_guide), 18, '{"en": {"title": "Church of Santa María de la Alhambra", "description": "16th-century church built on the site of the former Alhambra mosque."}}', 37.1770, -3.5888),
  ((SELECT id FROM new_guide), 19, '{"en": {"title": "Water Tower (Aqueduct Entry)", "description": "Point where the Royal Canal enters the Alhambra."}}', 37.1764, -3.5856),
  ((SELECT id FROM new_guide), 20, '{"en": {"title": "Royal Canal (Outer Section)", "description": "Master channel that diverts water from the Darro River."}}', 37.1778, -3.5845),
  ((SELECT id FROM new_guide), 21, '{"en": {"title": "Generalife Reservoirs", "description": "Large medieval cistern used to pressurize and irrigate higher terraces."}}', 37.1772, -3.5860),
  ((SELECT id FROM new_guide), 22, '{"en": {"title": "Oleander Walk (Generalife)", "description": "Path linked to subterranean catchment galleries."}}', 37.1775, -3.5868),
  ((SELECT id FROM new_guide), 23, '{"en": {"title": "Generalife", "description": "The recreation residence and orchards of the Nasrid sultans."}}', 37.1769, -3.5873),
  ((SELECT id FROM new_guide), 24, '{"en": {"title": "Sultana’s Viewpoint (Upper Generalife)", "description": "High terraces with direct views of the Nasrid palaces."}}', 37.1778, -3.5870),
  ((SELECT id FROM new_guide), 25, '{"en": {"title": "Monument to Ángel Ganivet", "description": "Corner of the Alhambra Forest dedicated to the Granada-born writer."}}', 37.1740, -3.5930)
ON CONFLICT (guide_id, "order") DO UPDATE SET
  texts = EXCLUDED.texts,
  lat = EXCLUDED.lat,
  lon = EXCLUDED.lon;

-- -----------------------------------------------------------------------------
-- Función RPC para puntuar una guía
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rate_guide(guide_id_to_rate uuid, rating_value int)
RETURNS void AS $$
BEGIN
  -- Validar que el rating esté entre 1 y 5
  IF rating_value < 1 OR rating_value > 5 THEN
    RAISE EXCEPTION 'Rating value must be between 1 and 5';
  END IF;

  -- Actualizar la guía. Se usa 'rating' como la suma total de puntuaciones.
  UPDATE public.guides
  SET
    rating = rating + rating_value,
    rating_count = rating_count + 1
  WHERE id = guide_id_to_rate;
END;
$$ LANGUAGE plpgsql;
