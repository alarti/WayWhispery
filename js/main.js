/*
 * WayWhispery - Redesigned Application
 * Author: Alberto Arce (Original)
 * Redesign: Jules
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

document.addEventListener('DOMContentLoaded', () => {

    // -----------------------------------------------------------------------------
    // Supabase & App Config
    // -----------------------------------------------------------------------------
    const SUPABASE_URL = 'https://whfcesalellvnrbdcsbb.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoZmNlc2FsZWxsdm5yYmRjc2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNTY0NDMsImV4cCI6MjA3MDkzMjQ0M30.wjzU9y1pudSctnLxaIIAfG8FKbMalLbKU4rto99vP9E';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // -----------------------------------------------------------------------------
    // DOM Elements
    // -----------------------------------------------------------------------------
    // Layout
    const activityGuidesBtn = document.getElementById('activity-guides-btn');
    const activityMapBtn = document.getElementById('activity-map-btn');
    const sidebarGuidesView = document.getElementById('sidebar-guides-view');
    const sidebarMapView = document.getElementById('sidebar-map-view');

    // Auth
    const authContainer = document.getElementById('auth-container-activity');

    // Guides View
    const guideCatalogList = document.getElementById('guide-catalog-list');
    const createNewGuideBtn = document.getElementById('create-new-guide-btn');

    // Map View
    const guideTitleSidebar = document.getElementById('guide-title-sidebar');
    const modeControlsSidebar = document.getElementById('mode-controls-sidebar');
    const guideMetaContainer = document.getElementById('guide-meta-container');
    const authorNameSpan = document.getElementById('author-name');
    const poiList = document.getElementById('poi-list');

    // Modal
    const formModal = document.getElementById('form-modal');
    const formModalTitle = document.getElementById('form-modal-title');
    const formModalContent = document.getElementById('form-modal-content');
    const formModalCloseBtn = formModal.querySelector('.modal-close-btn');

    // -----------------------------------------------------------------------------
    // Application State
    // -----------------------------------------------------------------------------
    let map;
    const poiMarkers = {};
    let currentGuide = null;
    let pois = [];
    let tourRoute = [];
    let currentUser = null;
    let userProfile = null;
    let isEditMode = false;

    // -----------------------------------------------------------------------------
    // Layout & UI Logic
    // -----------------------------------------------------------------------------
    function setupLayoutListeners() {
        activityGuidesBtn.addEventListener('click', () => switchSidebarView('guides'));
        activityMapBtn.addEventListener('click', () => switchSidebarView('map'));
    }

    function switchSidebarView(viewName) {
        if (viewName === 'guides') {
            sidebarGuidesView.classList.add('active');
            sidebarMapView.classList.remove('active');
            activityGuidesBtn.classList.add('active');
            activityMapBtn.classList.remove('active');
        } else if (viewName === 'map') {
            sidebarGuidesView.classList.remove('active');
            sidebarMapView.classList.add('active');
            activityGuidesBtn.classList.remove('active');
            activityMapBtn.classList.add('active');
        }
    }

    function updateUIforAuth() {
        const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';
        if (currentUser) {
            authContainer.innerHTML = `<button id="logout-btn" class="activity-btn" title="Logout"><i class="fas fa-sign-out-alt"></i></button>`;
            authContainer.querySelector('#logout-btn').addEventListener('click', logout);
        } else {
            authContainer.innerHTML = `<button id="login-btn" class="activity-btn" title="Login"><i class="fas fa-sign-in-alt"></i></button>`;
            authContainer.querySelector('#login-btn').addEventListener('click', loginWithGoogle);
        }
        createNewGuideBtn.classList.toggle('hidden', !isEditor);
    }

    function updateMapView() {
        if (currentGuide) {
            guideTitleSidebar.textContent = currentGuide.title;
            authorNameSpan.textContent = currentGuide.author?.email || 'Unknown';
            guideMetaContainer.classList.remove('hidden');
            renderPoiList();
            renderPois();
            drawTourRoute();
            setMode('view'); // Always start in view mode
        } else {
            guideTitleSidebar.textContent = 'No Guide Loaded';
            authorNameSpan.textContent = '';
            guideMetaContainer.classList.add('hidden');
            poiList.innerHTML = '';
        }
    }

    // -----------------------------------------------------------------------------
    // Map Logic
    // -----------------------------------------------------------------------------
    function initializeMap() {
        map = L.map('map-container').setView([40.4167, -3.7038], 5); // Default to Spain
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
    }

    function renderPois() {
        for (const markerId in poiMarkers) {
            poiMarkers[markerId].remove();
            delete poiMarkers[markerId];
        }
        pois.forEach(poi => {
            const marker = L.marker([poi.lat, poi.lon], {
                draggable: isEditMode
            }).addTo(map).bindPopup(poi.name);
            poiMarkers[poi.id] = marker;
        });
    }

    function drawTourRoute() {
        let routePolylines = [];
        routePolylines.forEach(line => line.remove());
        routePolylines = [];
        for (let i = 0; i < tourRoute.length - 1; i++) {
            const startPoi = pois.find(p => p.id === tourRoute[i]);
            const endPoi = pois.find(p => p.id === tourRoute[i + 1]);
            if (startPoi && endPoi) {
                const line = L.polyline([[startPoi.lat, startPoi.lon], [endPoi.lat, endPoi.lon]], { color: '#3388ff', weight: 3, opacity: 0.7 }).addTo(map);
                routePolylines.push(line);
            }
        }
    }

    // -----------------------------------------------------------------------------
    // Data & Auth Logic
    // -----------------------------------------------------------------------------
    async function loginWithGoogle() {
        await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
    }

    async function logout() {
        await supabase.auth.signOut();
        window.location.reload(); // Reload to clear state
    }

    async function getProfile(userId) {
        const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
        return error ? null : data;
    }

    async function fetchAndDisplayGuides() {
        // This function will be expanded to handle the bug fix later
        const { data: guides, error } = await supabase.from('guides').select('id, title, summary, slug').eq('status', 'published');
        if (error) {
            guideCatalogList.innerHTML = '<p>Could not load guides.</p>';
            return;
        }
        guideCatalogList.innerHTML = '';
        guides.forEach(guide => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `<h5 class="card-title">${guide.title}</h5><p class="card-text">${guide.summary || ''}</p>`;
            card.addEventListener('click', () => loadGuide(guide.slug));
            guideCatalogList.appendChild(card);
        });
    }

    async function loadGuide(slug) {
        const { data: guideData, error } = await supabase.from('guides').select('*, author:profiles(email)').eq('slug', slug).single();
        if (error || !guideData) { return; }
        const { data: sectionsData, error: sectionsError } = await supabase.from('guide_sections').select('*').eq('guide_id', guideData.id).order('order');
        if (sectionsError) { return; }
        currentGuide = guideData;
        pois = sectionsData.map(s => ({ ...s, name: s.title, description: s.body_md }));
        tourRoute = pois.map(p => p.id);
        map.setView([currentGuide.initial_lat, currentGuide.initial_lon], currentGuide.initial_zoom);
        updateMapView();
        switchSidebarView('map');
    }

    // -----------------------------------------------------------------------------
    // Edit Mode & CRUD
    // -----------------------------------------------------------------------------
    function setMode(mode) {
        isEditMode = mode === 'edit';
        modeControlsSidebar.innerHTML = '';
        const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';
        if (!isEditor || !currentGuide) return;

        if (isEditMode) {
            map.on('click', onMapClick);
            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn-modern btn-modern-sm';
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
            saveBtn.onclick = saveGuide;
            modeControlsSidebar.appendChild(saveBtn);

            const exitBtn = document.createElement('button');
            exitBtn.className = 'btn-modern btn-modern-sm btn-modern-secondary';
            exitBtn.innerHTML = '<i class="fas fa-times"></i> Exit';
            exitBtn.onclick = () => setMode('view');
            modeControlsSidebar.appendChild(exitBtn);
        } else {
            map.off('click', onMapClick);
            const editBtn = document.createElement('button');
            editBtn.className = 'btn-modern btn-modern-sm';
            editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit Guide';
            editBtn.onclick = () => setMode('edit');
            modeControlsSidebar.appendChild(editBtn);
        }
        renderPois();
        renderPoiList();
    }

    function renderPoiList() {
        poiList.innerHTML = '';
        pois.forEach(poi => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.innerHTML = `<span>${poi.name}</span>`;
            if (isEditMode) {
                const btnGroup = document.createElement('div');
                btnGroup.className = 'btn-group';
                btnGroup.innerHTML = `
                    <button class="btn-modern btn-modern-sm btn-modern-secondary edit-poi-btn" data-id="${poi.id}"><i class="fas fa-pen"></i></button>
                    <button class="btn-modern btn-modern-sm btn-modern-danger delete-poi-btn" data-id="${poi.id}"><i class="fas fa-trash"></i></button>
                `;
                li.appendChild(btnGroup);
            }
            poiList.appendChild(li);
        });

        // Add event listeners after rendering
        poiList.querySelectorAll('.edit-poi-btn').forEach(btn => btn.addEventListener('click', (e) => editPoi(e.currentTarget.dataset.id)));
        poiList.querySelectorAll('.delete-poi-btn').forEach(btn => btn.addEventListener('click', (e) => deletePoi(e.currentTarget.dataset.id)));
    }

    function onMapClick(e) {
        if (!isEditMode) return;
        const { lat, lng } = e.latlng;
        showFormModal('Add New POI', `
            <form>
                <div class="form-group"><label for="name">Name</label><input type="text" name="name" required></div>
                <div class="form-group"><label for="description">Description</label><textarea name="description" rows="3"></textarea></div>
                <button type="submit" class="btn-modern">Add POI</button>
            </form>`, (data) => {
            const newPoi = { id: `temp-${Date.now()}`, lat, lon: lng, name: data.name, description: data.description };
            pois.push(newPoi);
            tourRoute.push(newPoi.id);
            renderPois();
            renderPoiList();
            drawTourRoute();
            return true;
        });
    }

    function editPoi(poiId) {
        const poi = pois.find(p => p.id === poiId);
        if (!poi) return;
        showFormModal('Edit POI', `
            <form>
                <div class="form-group"><label for="name">Name</label><input type="text" name="name" value="${poi.name}" required></div>
                <div class="form-group"><label for="description">Description</label><textarea name="description" rows="3">${poi.description}</textarea></div>
                <button type="submit" class="btn-modern">Save Changes</button>
            </form>`, (data) => {
            poi.name = data.name;
            poi.description = data.description;
            renderPois();
            renderPoiList();
            return true;
        });
    }

    function deletePoi(poiId) {
        if (!confirm('Are you sure?')) return;
        pois = pois.filter(p => p.id !== poiId);
        tourRoute = tourRoute.filter(id => id !== poiId);
        renderPois();
        renderPoiList();
        drawTourRoute();
    }

    async function createNewGuide() {
        showFormModal('Create New Guide', `
            <form>
                <div class="form-group"><label for="title">Title</label><input type="text" name="title" required></div>
                <div class="form-group"><label for="slug">Slug</label><input type="text" name="slug" required pattern="[a-z0-9-]+"></div>
                <div class="form-group"><label for="summary">Summary</label><textarea name="summary" rows="3"></textarea></div>
                <button type="submit" class="btn-modern">Create and Edit</button>
            </form>`, async (data) => {
            const { data: guideData, error } = await supabase.from('guides').insert({ ...data, author_id: currentUser.id, status: 'draft', initial_lat: map.getCenter().lat, initial_lon: map.getCenter().lng, initial_zoom: map.getZoom() }).select().single();
            if (error) { alert(`Error: ${error.message}`); return false; }
            await loadGuide(guideData.slug);
            setMode('edit');
            return true;
        });
    }

    async function saveGuide() {
        const sectionsToSave = pois.map((poi, index) => ({ guide_id: currentGuide.id, title: poi.name, body_md: poi.description, lat: poi.lat, lon: poi.lon, order: index, ...(poi.id.toString().startsWith('temp-') ? {} : { id: poi.id }) }));
        const { error } = await supabase.from('guide_sections').upsert(sectionsToSave);
        if (error) { alert(`Error saving: ${error.message}`); }
        else { alert('Guide saved!'); await loadGuide(currentGuide.slug); }
    }

    // -----------------------------------------------------------------------------
    // Modal System
    // -----------------------------------------------------------------------------
    function showFormModal(title, formHTML, submitCallback) {
        formModalTitle.textContent = title;
        formModalContent.innerHTML = formHTML;
        formModal.classList.remove('hidden');
        const form = formModalContent.querySelector('form');
        function handleSubmit(e) {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            if (submitCallback(data)) { hideFormModal(); }
        }
        form.addEventListener('submit', handleSubmit);
        formModalCloseBtn.onclick = () => hideFormModal();
    }

    function hideFormModal() {
        formModal.classList.add('hidden');
        formModalContent.innerHTML = '';
    }

    // -----------------------------------------------------------------------------
    // Initializer
    // -----------------------------------------------------------------------------
    async function init() {
        initializeMap();
        setupLayoutListeners();

        supabase.auth.onAuthStateChange(async (event, session) => {
            currentUser = session?.user || null;
            userProfile = currentUser ? await getProfile(currentUser.id) : null;
            updateUIforAuth();
        });

        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session?.user || null;
        userProfile = currentUser ? await getProfile(currentUser.id) : null;
        updateUIforAuth();

        fetchAndDisplayGuides();
        updateMapView(); // Initial update
    }

    init();
});
// NOTE: This is a skeleton. The unchanged functions need to be filled in.
// I'm overwriting the file to establish the new structure.
// The next steps will be to fill in the unchanged function bodies.
