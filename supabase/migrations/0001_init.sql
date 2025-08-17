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
    title TEXT NOT NULL,
    summary TEXT,
    language TEXT NOT NULL,
    cover_url TEXT,
    status TEXT CHECK (status IN ('draft', 'published')) DEFAULT 'draft' NOT NULL,
    author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    initial_lat DOUBLE PRECISION,
    initial_lon DOUBLE PRECISION,
    initial_zoom INTEGER
);


-- -----------------------------------------------------------------------------
-- Tabla: guide_sections
-- Almacena las secciones de contenido de una guía, en orden. (También son los POIs)
-- -----------------------------------------------------------------------------
CREATE TABLE guide_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_id uuid REFERENCES guides(id) ON DELETE CASCADE NOT NULL,
    "order" INTEGER DEFAULT 0,
    title TEXT,
    body_md TEXT,
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
-- Políticas de RLS para `guide_sections`, `tags`, `guide_tags`, `media`
-- -----------------------------------------------------------------------------

-- guide_sections
CREATE POLICY "Allow public read on sections of published guides" ON guide_sections
FOR SELECT USING (
  (SELECT status FROM guides WHERE id = guide_id) = 'published'
);

CREATE POLICY "Allow full access for editors/admins on sections" ON guide_sections
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
  INSERT INTO guides (slug, title, summary, language, status, author_id, cover_url, initial_lat, initial_lon, initial_zoom)
  VALUES
    ('alhambra-general', 'Guía Esencial de la Alhambra', 'Un recorrido completo por el monumento nazarí, desde la Alcazaba hasta los jardines del Generalife.', 'es', 'published', (SELECT id FROM editor), 'https://images.unsplash.com/photo-1589920038833-2457106fe3a2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80', 37.1773, -3.5986, 15)
  ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary
  RETURNING id
)
INSERT INTO guide_sections (guide_id, "order", title, body_md, lat, lon)
VALUES
  ((SELECT id FROM new_guide), 1, 'Gate of the Pomegranates', 'Classic ascent from Plaza Nueva through the tree-lined Cuesta de Gomérez to the monumental Gate of the Pomegranates.', 37.1745, -3.5936),
  ((SELECT id FROM new_guide), 2, 'Alhambra Forest', 'Historic forest planted in the time of Charles V, with species brought from the Americas like horse chestnuts.', 37.1755, -3.5920),
  ((SELECT id FROM new_guide), 3, 'Gate of Justice', 'Monumental entrance with bent archway, a hand of Fatima and a key in the keystone.', 37.1760, -3.5907),
  ((SELECT id FROM new_guide), 4, 'Pillar of Charles V', 'Renaissance fountain from 1554 with three faces and several spouts, full of allegories.', 37.1762, -3.5905),
  ((SELECT id FROM new_guide), 5, 'Palace of Charles V', 'Renaissance imperial palace with a monumental circular courtyard, it houses museums.', 37.1767, -3.5900),
  ((SELECT id FROM new_guide), 6, 'Court of the Myrtles (Comares)', 'Water mirror between myrtle hedges reflecting the Comares Tower.', 37.1773, -3.5896),
  ((SELECT id FROM new_guide), 7, 'Court of the Lions', 'The heart of the Nasrid palaces, celebrated for its central fountain supported by twelve marble lions.', 37.1773, -3.5890),
  ((SELECT id FROM new_guide), 8, 'Hall of the Abencerrajes', 'A legendary room in the Palace of the Lions with a star-shaped muqarnas dome.', 37.1771, -3.5890),
  ((SELECT id FROM new_guide), 9, 'Royal Baths (Nasrid Hammam)', 'Bath complex with cold, warm, and hot rooms, and star-shaped skylights.', 37.1776, -3.5898),
  ((SELECT id FROM new_guide), 10, 'Water Channels of the Court of the Lions', 'Network of shallow channels in four axes radiating from the fountain.', 37.1774, -3.5891),
  ((SELECT id FROM new_guide), 11, 'Partal Gardens and Paths', 'Avenues of myrtle hedges, viewpoints, and small ponds linking the Partal to palaces.', 37.1780, -3.5880),
  ((SELECT id FROM new_guide), 12, 'Partal Palace', 'Palatial complex with a portico reflected in a large pond, one of the oldest preserved in the Alhambra.', 37.1782, -3.5885),
  ((SELECT id FROM new_guide), 13, 'Alhambra Museum', 'Collection of Nasrid artifacts and original pieces such as the hydraulic cylinder of the Fountain of the Lions.', 37.1768, -3.5901),
  ((SELECT id FROM new_guide), 14, 'Alhambra Medina', 'Excavated area that housed noble residences, artisan workshops, markets, and public baths.', 37.1765, -3.5885),
  ((SELECT id FROM new_guide), 15, 'Alcazaba', 'The oldest sector, a military citadel with watchtowers and views over Granada.', 37.1772, -3.5925),
  ((SELECT id FROM new_guide), 16, 'Gate of Arms', 'Original military access on the Darro slope, linked to the Tower of Arms.', 37.1780, -3.5930),
  ((SELECT id FROM new_guide), 17, 'Gate of the Seven Floors', 'Gate on the southern wall with late bastions.', 37.1750, -3.5895),
  ((SELECT id FROM new_guide), 18, 'Church of Santa María de la Alhambra', '16th-century church built on the site of the former Alhambra mosque.', 37.1770, -3.5888),
  ((SELECT id FROM new_guide), 19, 'Water Tower (Aqueduct Entry)', 'Point where the Royal Canal enters the Alhambra via an eastern aqueduct.', 37.1764, -3.5856),
  ((SELECT id FROM new_guide), 20, 'Royal Canal (Outer Section)', 'Master channel that diverts water from the Darro River about 6.1 km upstream.', 37.1778, -3.5845),
  ((SELECT id FROM new_guide), 21, 'Generalife Reservoirs', 'Large medieval cistern used to pressurize and irrigate higher terraces.', 37.1772, -3.5860),
  ((SELECT id FROM new_guide), 22, 'Oleander Walk (Generalife)', 'Path linked to subterranean catchment galleries supplying reservoirs.', 37.1775, -3.5868),
  ((SELECT id FROM new_guide), 23, 'Generalife', 'The recreation residence and orchards of the Nasrid sultans.', 37.1769, -3.5873),
  ((SELECT id FROM new_guide), 24, 'Sultana’s Viewpoint (Upper Generalife)', 'High terraces with direct views of the Nasrid palaces.', 37.1778, -3.5870),
  ((SELECT id FROM new_guide), 25, 'Monument to Ángel Ganivet', 'Corner of the Alhambra Forest dedicated to the Granada-born writer and diplomat.', 37.1740, -3.5930)
ON CONFLICT (guide_id, "order") DO UPDATE SET
  title = EXCLUDED.title,
  body_md = EXCLUDED.body_md,
  lat = EXCLUDED.lat,
  lon = EXCLUDED.lon;
