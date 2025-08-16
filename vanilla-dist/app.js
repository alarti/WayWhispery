// app.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// -----------------------------------------------------------------------------
// Configuración de Supabase
// -----------------------------------------------------------------------------
const SUPABASE_URL = 'https://<ID-DE-PROYECTO-SUPABASE>.supabase.co';
const SUPABASE_ANON_KEY = '<TU-CLAVE-ANON-PUBLICA>';

if (SUPABASE_URL.includes('ID-DE-PROYECTO') || SUPABASE_ANON_KEY.includes('TU-CLAVE')) {
    alert('Error: Debes configurar las variables SUPABASE_URL y SUPABASE_ANON_KEY en app.js');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -----------------------------------------------------------------------------
// Selectores del DOM
// -----------------------------------------------------------------------------
const authContainer = document.getElementById('auth-container');
const userInfo = document.getElementById('user-info');
const userEmail = document.getElementById('user-email');
const userRole = document.getElementById('user-role');
const editorControls = document.getElementById('editor-controls');
const newGuideBtn = document.getElementById('new-guide-btn');
const guidesContainer = document.getElementById('guides-container');
const guidesList = document.getElementById('guides-list');
const guideDetailContainer = document.getElementById('guide-detail-container');
const guideFormContainer = document.getElementById('guide-form-container');
const guideForm = document.getElementById('guide-form');
const formTitle = document.getElementById('form-title');
const filtersContainer = document.getElementById('filters-container');
const paginationContainer = document.getElementById('pagination-container');
const loadMoreBtn = document.getElementById('load-more-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const addSectionBtn = document.getElementById('add-section-btn');
const sectionsList = document.getElementById('sections-list');
const coverPreview = document.getElementById('cover-preview');
const guideCoverInput = document.getElementById('guide-cover-input');

// -----------------------------------------------------------------------------
// Estado de la Aplicación
// -----------------------------------------------------------------------------
let currentUser = null;
let userProfile = null;
let currentPage = 0;
const GUIDES_PER_PAGE = 6;
let currentFilters = { language: 'all', tag: 'all' };
let totalGuides = 0;

// -----------------------------------------------------------------------------
// Funciones de Autenticación
// -----------------------------------------------------------------------------
async function loginWithGoogleRedirect() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) console.error('Error al iniciar sesión con Google:', error.message);
}

async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error al cerrar sesión:', error.message);
    } else {
        window.location.href = window.location.pathname;
    }
}

async function getProfile(userId) {
    const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (error) {
        console.error('Error al obtener el perfil:', error);
        return null;
    }
    return data;
}

// -----------------------------------------------------------------------------
// Funciones de Renderizado de UI
// -----------------------------------------------------------------------------
function renderUI() {
    const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';

    if (currentUser && userProfile) {
        authContainer.innerHTML = '<button id="logout-btn">Cerrar Sesión</button>';
        document.getElementById('logout-btn').addEventListener('click', logout);
        userInfo.classList.remove('hidden');
        userEmail.textContent = currentUser.email;
        userRole.textContent = userProfile.role;
        editorControls.classList.toggle('hidden', !isEditor);
    } else {
        authContainer.innerHTML = '<button id="login-btn">Continuar con Google</button>';
        document.getElementById('login-btn').addEventListener('click', loginWithGoogleRedirect);
        userInfo.classList.add('hidden');
        editorControls.classList.add('hidden');
    }
}

function renderGuidesList(guides, append = false) {
    if (!append) guidesList.innerHTML = '';
    if (!guides || guides.length === 0) {
        if (!append) guidesList.innerHTML = '<p>No hay guías que coincidan con los filtros.</p>';
        paginationContainer.classList.add('hidden');
        return;
    }
    guidesList.innerHTML += guides.map(guide => `
        <div class="guide-card" data-slug="${guide.slug}">
            <img src="${guide.cover_url || 'https://via.placeholder.com/300x180.png?text=Guía'}" alt="Portada de ${guide.title}">
            <div class="guide-card-content">
                <h3>${guide.title}</h3>
                <p>${guide.summary || ''}</p>
                <small>Idioma: ${guide.language}</small>
            </div>
        </div>
    `).join('');
    const currentlyDisplayed = guidesList.children.length;
    paginationContainer.classList.toggle('hidden', currentlyDisplayed >= totalGuides);
}

function renderGuideDetail(guide, sections) {
    guidesContainer.classList.add('hidden');
    guideDetailContainer.classList.remove('hidden');
    const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';

    guideDetailContainer.innerHTML = `
        <button id="back-to-list-btn">&larr; Volver a la lista</button>
        ${isEditor ? `<button id="edit-guide-btn" data-guide-id="${guide.id}">Editar Guía</button>` : ''}
        <h2>${guide.title}</h2>
        <p><em>${guide.summary}</em></p>
        ${guide.cover_url ? `<img src="${guide.cover_url}" alt="Portada de ${guide.title}" class="cover-image">` : ''}
        <hr>
        ${sections.map(section => `
            <div class="guide-section">
                <h3>${section.title}</h3>
                <p>${section.body_md ? section.body_md.replace(/\n/g, '<br>') : ''}</p>
            </div>
        `).join('')}
    `;

    document.getElementById('back-to-list-btn').addEventListener('click', showListView);
    if (isEditor) {
        document.getElementById('edit-guide-btn').addEventListener('click', () => fetchGuideBySlug(guide.slug, true));
    }
}

async function renderFilters() {
    const { data: languages, error: langError } = await supabase.from('guides').select('language').eq('status', 'published');
    const { data: tags, error: tagError } = await supabase.from('tags').select('name, slug');
    if (langError || tagError) {
        console.error("Error fetching filters data", { langError, tagError });
        return;
    }
    const uniqueLanguages = [...new Set(languages.map(l => l.language))];
    filtersContainer.innerHTML = `
        <select id="lang-filter"><option value="all">Idiomas</option>${uniqueLanguages.map(lang => `<option value="${lang}">${lang}</option>`).join('')}</select>
        <select id="tag-filter"><option value="all">Etiquetas</option>${tags.map(tag => `<option value="${tag.slug}">${tag.name}</option>`).join('')}</select>
    `;
    document.getElementById('lang-filter').addEventListener('change', (e) => { currentFilters.language = e.target.value; resetAndFetchGuides(); });
    document.getElementById('tag-filter').addEventListener('change', (e) => { currentFilters.tag = e.target.value; resetAndFetchGuides(); });
}

function renderGuideForm(guide = {}, sections = []) {
    guidesContainer.classList.add('hidden');
    guideDetailContainer.classList.add('hidden');
    guideFormContainer.classList.remove('hidden');

    formTitle.textContent = guide.id ? 'Editar Guía' : 'Crear Nueva Guía';
    guideForm.reset();
    document.getElementById('guide-id').value = guide.id || '';
    document.getElementById('guide-title-input').value = guide.title || '';
    document.getElementById('guide-slug-input').value = guide.slug || '';
    document.getElementById('guide-summary-input').value = guide.summary || '';
    document.getElementById('guide-language-input').value = guide.language || 'es';
    document.getElementById('guide-status-select').value = guide.status || 'draft';

    if (guide.cover_url) {
        coverPreview.src = guide.cover_url;
        coverPreview.classList.remove('hidden');
    } else {
        coverPreview.classList.add('hidden');
    }

    sectionsList.innerHTML = '';
    sections.forEach(s => renderSectionInput(s));
}

function renderSectionInput(section = {}) {
    const div = document.createElement('div');
    div.className = 'section-item';
    div.innerHTML = `
        <input type="hidden" class="section-id" value="${section.id || ''}">
        <label>Título de la sección:</label>
        <input type="text" class="section-title" value="${section.title || ''}">
        <label>Contenido (Markdown):</label>
        <textarea class="section-body" rows="5">${section.body_md || ''}</textarea>
        <button type="button" class="remove-section-btn">Eliminar Sección</button>
    `;
    sectionsList.appendChild(div);
    div.querySelector('.remove-section-btn').addEventListener('click', () => div.remove());
}

// -----------------------------------------------------------------------------
// Funciones de Carga y Guardado de Datos (CRUD)
// -----------------------------------------------------------------------------
async function fetchGuides(append = false) {
    let query = supabase.from('guides').select('*, guide_tags!inner(tags!inner(slug))', { count: 'exact' }).eq('status', 'published');
    if (currentFilters.language !== 'all') query = query.eq('language', currentFilters.language);
    if (currentFilters.tag !== 'all') query = query.eq('guide_tags.tags.slug', currentFilters.tag);

    const start = currentPage * GUIDES_PER_PAGE;
    const { data, error, count } = await query.range(start, start + GUIDES_PER_PAGE - 1).order('updated_at', { ascending: false });

    if (error) { console.error('Error al cargar las guías:', error); guidesList.innerHTML = '<p>Error al cargar las guías.</p>'; return; }
    totalGuides = count;
    renderGuidesList(data, append);
}

function resetAndFetchGuides() {
    currentPage = 0;
    guidesList.innerHTML = '<p>Cargando guías...</p>';
    fetchGuides(false);
}

async function fetchGuideBySlug(slug, forEdit = false) {
    const { data: guideData, error: guideError } = await supabase.from('guides').select('*').eq('slug', slug).single();
    if (guideError) { alert('Error al cargar la guía.'); console.error(guideError); return; }
    if (!guideData) { alert('Guía no encontrada.'); return; }

    const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';
    if (!forEdit && guideData.status !== 'published' && !isEditor) { alert('No tienes permiso para ver esta guía.'); showListView(); return; }

    const { data: sectionsData, error: sectionsError } = await supabase.from('guide_sections').select('*').eq('guide_id', guideData.id).order('order');
    if (sectionsError) { alert('Error al cargar las secciones.'); console.error(sectionsError); return; }

    if (forEdit && isEditor) {
        renderGuideForm(guideData, sectionsData);
    } else {
        renderGuideDetail(guideData, sectionsData);
    }
}

async function uploadGuideCover(file, guideId) {
    if (!file) return null;
    const fileName = `${guideId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('guides').upload(fileName, file);
    if (error) {
        console.error('Error subiendo imagen:', error);
        return null;
    }
    const { data } = supabase.storage.from('guides').getPublicUrl(fileName);
    return data.publicUrl;
}

async function saveGuide(event) {
    event.preventDefault();
    const guideId = document.getElementById('guide-id').value;
    const coverFile = guideCoverInput.files[0];

    // --- 0. Subir imagen si existe ---
    let coverUrl = document.getElementById('cover-preview').src;
    if (coverFile) {
        // Si es una guía nueva, necesitamos un ID para la ruta. Usaremos un uuid temporal.
        const tempId = guideId || crypto.randomUUID();
        const newUrl = await uploadGuideCover(coverFile, tempId);
        if (newUrl) {
            coverUrl = newUrl;
        } else {
            alert("Error al subir la imagen de portada. La guía se guardará sin ella.");
        }
    }

    const guideData = {
        title: document.getElementById('guide-title-input').value,
        slug: document.getElementById('guide-slug-input').value,
        summary: document.getElementById('guide-summary-input').value,
        language: document.getElementById('guide-language-input').value,
        status: document.getElementById('guide-status-select').value,
        author_id: currentUser.id,
        cover_url: coverUrl.startsWith('blob:') ? null : coverUrl, // No guardar URLs de blob
    };

    // --- 1. Guardar la guía principal (Insert o Update) ---
    let savedGuide;
    if (guideId) {
        const { data, error } = await supabase.from('guides').update(guideData).eq('id', guideId).select().single();
        if (error) { alert(`Error al actualizar la guía: ${error.message}`); return; }
        savedGuide = data;
    } else {
        const { data, error } = await supabase.from('guides').insert(guideData).select().single();
        if (error) { alert(`Error al crear la guía: ${error.message}`); return; }
        savedGuide = data;
    }

    // --- 2. Guardar las secciones ---
    const sectionNodes = sectionsList.querySelectorAll('.section-item');
    const sectionPromises = Array.from(sectionNodes).map((node, index) => {
        const section = {
            guide_id: savedGuide.id,
            title: node.querySelector('.section-title').value,
            body_md: node.querySelector('.section-body').value,
            order: index,
        };
        const sectionId = node.querySelector('.section-id').value;
        if (sectionId) {
            return supabase.from('guide_sections').update(section).eq('id', sectionId);
        } else {
            return supabase.from('guide_sections').insert(section);
        }
    });

    await Promise.all(sectionPromises);
    alert('Guía guardada con éxito!');
    showListView(true);
}

// -----------------------------------------------------------------------------
// Lógica de "Enrutamiento" y Vistas
// -----------------------------------------------------------------------------
function showListView(forceReload = false) {
    guideDetailContainer.classList.add('hidden');
    guideFormContainer.classList.add('hidden');
    guidesContainer.classList.remove('hidden');
    window.history.pushState({}, '', window.location.pathname);
    if (forceReload) resetAndFetchGuides();
}

function handleRouting() {
    const params = new URLSearchParams(window.location.search);
    const guideSlug = params.get('guide');
    if (guideSlug) {
        fetchGuideBySlug(guideSlug);
    } else {
        showListView();
        if (guidesList.innerHTML.trim() === '' || guidesList.innerHTML.includes('Cargando')) {
            resetAndFetchGuides();
            renderFilters();
        }
    }
}

function bindEventListeners() {
    guidesList.addEventListener('click', (e) => {
        const card = e.target.closest('.guide-card');
        if (card) {
            const slug = card.dataset.slug;
            window.history.pushState({ slug }, ``, `?guide=${slug}`);
            fetchGuideBySlug(slug);
        }
    });
    window.addEventListener('popstate', handleRouting);
    loadMoreBtn.addEventListener('click', () => { currentPage++; fetchGuides(true); });
    newGuideBtn.addEventListener('click', () => renderGuideForm());
    cancelEditBtn.addEventListener('click', () => showListView());
    addSectionBtn.addEventListener('click', () => renderSectionInput());
    guideForm.addEventListener('submit', saveGuide);
    guideCoverInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            coverPreview.src = URL.createObjectURL(file);
            coverPreview.classList.remove('hidden');
        }
    });
}

// -----------------------------------------------------------------------------
// Inicialización
// -----------------------------------------------------------------------------
async function init() {
    bindEventListeners();
    supabase.auth.onAuthStateChange(async (event, session) => {
        currentUser = session?.user || null;
        userProfile = currentUser ? await getProfile(currentUser.id) : null;
        renderUI();
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') showListView(true);
    });
    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user || null;
    userProfile = currentUser ? await getProfile(currentUser.id) : null;
    renderUI();
    handleRouting();
}

document.addEventListener('DOMContentLoaded', init);
