/*
 * WayWhispery - Unified Application
 * Author: Alberto Arce (Original)
 * Integration: Jules
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

document.addEventListener('DOMContentLoaded', () => {

    // -----------------------------------------------------------------------------
    // Supabase & App Config
    // -----------------------------------------------------------------------------
    const SUPABASE_URL = 'https://whfcesalellvnrbdcsbb.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoZmNlc2FsZWxsdm5yYmRjc2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNTY0NDMsImV4cCI6MjA3MDkzMjQ0M30.wjzU9y1pudSctnLxaIIAfG8FKbMalLbKU4rto99vP9E';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- PWA Service Worker ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').then(registration => {
                console.log('SW registered: ', registration);
            }).catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
        });
    }

    // -----------------------------------------------------------------------------
    // DOM Elements
    // -----------------------------------------------------------------------------
    // Sidenav and Modals
    const sidePanel = document.getElementById('side-panel');
    const panelToggleBtn = document.getElementById('panel-toggle-btn');
    const welcomeModal = document.getElementById('welcome-modal');
    const aboutModal = document.getElementById('about-modal');
    const modalCloseBtn = aboutModal.querySelector('.modal-close-btn');

    // Guide Info
    const guideTitle = document.getElementById('guide-title');
    const guideMetaContainer = document.getElementById('guide-meta-container');
    const authorNameSpan = document.getElementById('author-name');
    const donationLink = document.getElementById('donation-link');
    const langSelector = document.getElementById('language-selector');
    const guideText = document.getElementById('guide-text-overlay').querySelector('p');

    // Controls
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const simulationModeToggle = document.getElementById('simulation-mode-toggle');
    const themeToggle = document.getElementById('theme-toggle');
    const modeControls = document.getElementById('mode-controls');

    // POI List
    const poiList = document.getElementById('poi-list');

    // Auth
    const authContainer = document.getElementById('auth-container');
    const userInfo = document.getElementById('user-info');
    const userEmail = document.getElementById('user-email');
    const userRole = document.getElementById('user-role');

    // Guide Catalog
    const guideCatalogList = document.getElementById('guide-catalog-list');
    const createNewGuideBtn = document.getElementById('create-new-guide-btn');
    const welcomeAuthContainer = document.getElementById('welcome-auth-container');
    createNewGuideBtn.addEventListener('click', createNewGuide);

    // Form Modal
    const formModal = document.getElementById('form-modal');
    const formModalTitle = document.getElementById('form-modal-title');
    const formModalContent = document.getElementById('form-modal-content');
    const formModalCloseBtn = formModal.querySelector('.modal-close-btn');

    // -----------------------------------------------------------------------------
    // Application State
    // -----------------------------------------------------------------------------
    // Map & PWA State
    let map;
    let userMarker;
    let geolocationId = null;
    const poiMarkers = {};
    let isSimulationMode = simulationModeToggle.checked;

    // Voice & Text
    const synth = window.speechSynthesis;
    let utterance = new SpeechSynthesisUtterance();
    let typewriterInterval = null;

    // Guide Data
    let currentGuide = null;
    let pois = [];
    let tourRoute = [];
    let currentLang = 'es';
    let availableLanguages = {};

    // Auth State
    let currentUser = null;
    let userProfile = null;

    // Edit Mode State
    let isEditMode = false;
    let isAddingPoi = false;

    // -----------------------------------------------------------------------------
    // Map Initialization
    // -----------------------------------------------------------------------------
    function initializeMap() {
        map = L.map('map-container').setView([37.1773, -3.5986], 15); // Default to Granada
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // map.on('click', onMapClick); // Will be enabled in edit mode
    }

    // -----------------------------------------------------------------------------
    // Authentication
    // -----------------------------------------------------------------------------
    async function loginWithGoogle() {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.href },
        });
        if (error) console.error('Error logging in with Google:', error.message);
    }

    async function logout() {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Error logging out:', error.message);
    }

    async function getProfile(userId) {
        const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
        if (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
        return data;
    }

    function renderUIforAuth() {
        const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';

        if (currentUser) {
            authContainer.innerHTML = '<button id="logout-btn" class="btn-modern btn-modern-secondary">Logout</button>';
            authContainer.querySelector('#logout-btn').addEventListener('click', logout);

            userInfo.classList.remove('hidden');
            userEmail.textContent = currentUser.email;
            userRole.textContent = userProfile?.role || 'viewer';
        } else {
            authContainer.innerHTML = '<button id="login-btn" class="btn-modern btn-modern-primary">Login with Google</button>';
            authContainer.querySelector('#login-btn').addEventListener('click', loginWithGoogle);
            userInfo.classList.add('hidden');

            welcomeAuthContainer.innerHTML = '<button id="welcome-login-btn" class="btn-modern btn-modern-secondary">Login to Create/Edit</button>';
            welcomeAuthContainer.querySelector('#welcome-login-btn').addEventListener('click', loginWithGoogle);
        }

        // Show/hide editor controls
        createNewGuideBtn.classList.toggle('hidden', !isEditor);
        welcomeAuthContainer.classList.toggle('hidden', isEditor || !!currentUser);
        // We will toggle more editor controls later in setMode()
    }


    // -----------------------------------------------------------------------------
    // Initializer
    // -----------------------------------------------------------------------------
    async function init() {
        console.log("Initializing application...");
        initializeMap();

        // Handle Auth
        supabase.auth.onAuthStateChange(async (event, session) => {
            currentUser = session?.user || null;
            userProfile = currentUser ? await getProfile(currentUser.id) : null;
            renderUIforAuth();

            // Reload guides or update UI if needed after auth change
            // For example, show draft guides if an editor logs in.
        });

        // Check initial session
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session?.user || null;
        userProfile = currentUser ? await getProfile(currentUser.id) : null;
        renderUIforAuth();

        // More to come:
        // - Event Listeners

        showWelcomeModal();
    }

    // -----------------------------------------------------------------------------
    // Data Loading
    // -----------------------------------------------------------------------------
    async function showWelcomeModal() {
        const { data: guides, error } = await supabase
            .from('guides')
            .select('id, title, summary, slug')
            .eq('status', 'published');

        if (error) {
            console.error('Error fetching guides:', error);
            guideCatalogList.innerHTML = '<p>Could not load guides.</p>';
            return;
        }

        guideCatalogList.innerHTML = '';
        guides.forEach(guide => {
            const card = document.createElement('div');
            card.className = 'card mb-3 guide-card'; // Add a class to identify
            card.dataset.guideSlug = guide.slug; // Use slug for loading
            card.innerHTML = `
                <div class="card-body">
                    <h5 class="card-title">${guide.title}</h5>
                    <p class="card-text">${guide.summary}</p>
                    <button class="btn-modern btn-modern-primary">Load Guide</button>
                </div>
            `;
            card.addEventListener('click', () => {
                loadGuide(guide.slug);
            });
            guideCatalogList.appendChild(card);
        });
        welcomeModal.classList.remove('hidden');
    }

    async function loadGuide(slug) {
        const { data: guideData, error: guideError } = await supabase
            .from('guides')
            .select('*, author:profiles(email)')
            .eq('slug', slug)
            .single();

        if (guideError || !guideData) {
            alert('Error loading guide.');
            console.error(guideError);
            return;
        }

        const { data: sectionsData, error: sectionsError } = await supabase
            .from('guide_sections')
            .select('*')
            .eq('guide_id', guideData.id)
            .order('order');

        if (sectionsError) {
            alert('Error loading guide sections.');
            console.error(sectionsError);
            return;
        }

        currentGuide = guideData;
        // The concept of POIs in the map app needs to be merged with 'guide_sections'
        // For now, let's treat sections as POIs if they have lat/lon.
        // This part needs more work to fully integrate.
        pois = sectionsData
            .filter(section => section.lat && section.lon)
            .map(section => ({
                id: section.id,
                lat: section.lat,
                lon: section.lon,
                name: section.title,
                description: section.body_md,
                texts: {
                    // This needs to be adapted based on how multilingual data is stored
                    [currentGuide.language]: { name: section.title, description: section.body_md }
                }
            }));

        tourRoute = pois.map(p => p.id); // Simple route based on order

        // Update UI
        welcomeModal.classList.add('hidden');
        guideTitle.textContent = currentGuide.title;
        if (currentGuide.author) {
            authorNameSpan.textContent = currentGuide.author.email;
            guideMetaContainer.classList.remove('hidden');
        }

        // This is a simplification. Full multilingual support needs more work.
        availableLanguages = { [currentGuide.language]: currentGuide.language };
        populateLanguageSelector();
        switchLanguage(currentGuide.language);

        map.setView([guideData.initial_lat, guideData.initial_lon], guideData.initial_zoom);

        renderPois();
        renderPoiList();
        drawTourRoute();
    }

    function populateLanguageSelector() {
        langSelector.innerHTML = '';
        for (const [code, name] of Object.entries(availableLanguages)) {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = name;
            if (code === currentLang) option.selected = true;
            langSelector.appendChild(option);
        }
        langSelector.addEventListener('change', (e) => switchLanguage(e.target.value));
    }

    function switchLanguage(langCode) {
        currentLang = langCode;
        pois.forEach(poi => {
            if (poi.texts && poi.texts[langCode]) {
                poi.name = poi.texts[langCode].name;
                poi.description = poi.texts[langCode].description;
            } else {
                const fallbackLang = Object.keys(poi.texts)[0];
                poi.name = poi.texts[fallbackLang].name;
                poi.description = poi.texts[fallbackLang].description;
            }
        });

        const langMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', zh: 'zh-CN' };
        utterance.lang = langMap[langCode] || 'en-US';

        renderPois();
        // renderPoiList();
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

            marker.on('click', () => {
                if (isSimulationMode && !isEditMode) simulateVisitToPoi(poi.id);
            });

            marker.on('dragend', (event) => {
                // Logic to update POI coordinates in the state
            });

            poiMarkers[poi.id] = marker;
        });
    }

    function simulateVisitToPoi(poiId) {
        const poi = pois.find(p => p.id === poiId);
        if (!poi) return;
        const { lat, lon } = poi;
        if (!userMarker) createUserMarker(lat, lon);
        else userMarker.setLatLng([lat, lon]);
        map.flyTo([lat, lon], 18);
        checkProximity(lat, lon);
    }

    function speak(text) {
        if (synth.speaking) synth.cancel();
        utterance.text = text;
        synth.speak(utterance);
    }

    function checkProximity(lat, lon) {
        // This function will be filled in later
    }

    function createUserMarker(lat, lon) {
        const userIcon = L.divIcon({
            html: '<div style="background-color: blue; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
            className: '',
            iconSize: [15, 15],
            iconAnchor: [9, 9]
        });
        userMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map);
        if (isSimulationMode) userMarker.setOpacity(0.5);
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
            if (submitCallback(data)) {
                hideFormModal();
            }
        }

        form.addEventListener('submit', handleSubmit);

        formModalCloseBtn.onclick = () => hideFormModal();
    }

    function hideFormModal() {
        formModal.classList.add('hidden');
        formModalContent.innerHTML = ''; // Clean up
    }


    // -----------------------------------------------------------------------------
    // Edit Mode & CRUD
    // -----------------------------------------------------------------------------
    function setMode(mode) {
        isEditMode = mode === 'edit';
        modeControls.innerHTML = ''; // Clear existing controls

        const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';
        if (!isEditor) return;

        if (isEditMode) {
            map.on('click', onMapClick);
            const saveBtn = document.createElement('button');
            saveBtn.id = 'save-guide-btn';
            saveBtn.className = 'btn-modern btn-modern-primary';
            saveBtn.textContent = 'Save Guide';
            saveBtn.onclick = saveGuide;
            modeControls.appendChild(saveBtn);

            const exitEditBtn = document.createElement('button');
            exitEditBtn.className = 'btn-modern btn-modern-secondary';
            exitEditBtn.textContent = 'Exit Edit Mode';
            exitEditBtn.onclick = () => setMode('view');
            modeControls.appendChild(exitEditBtn);
        } else {
            map.off('click', onMapClick);
            const enterEditBtn = document.createElement('button');
            enterEditBtn.className = 'btn-modern btn-modern-primary';
            enterEditBtn.textContent = 'Edit This Guide';
            enterEditBtn.onclick = () => setMode('edit');
            modeControls.appendChild(enterEditBtn);
        }
        renderPois(); // Re-render to apply draggable state
        renderPoiList();
    }

    function renderPoiList() {
        poiList.innerHTML = '';
        tourRoute.forEach(poiId => {
            const poi = pois.find(p => p.id === poiId);
            if (poi) {
                const li = document.createElement('li');
                li.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';

                const nameSpan = document.createElement('span');
                nameSpan.textContent = poi.name;
                nameSpan.dataset.poiId = poi.id;
                li.appendChild(nameSpan);

                if (isEditMode) {
                    const btnGroup = document.createElement('div');

                    const editBtn = document.createElement('button');
                    editBtn.className = 'btn-modern btn-modern-secondary btn-modern-sm me-2';
                    editBtn.textContent = 'Edit';
                    editBtn.onclick = () => editPoi(poi.id);

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn-modern btn-modern-danger btn-modern-sm';
                    deleteBtn.textContent = 'Del';
                    deleteBtn.onclick = () => deletePoi(poi.id);

                    btnGroup.appendChild(editBtn);
                    btnGroup.appendChild(deleteBtn);
                    li.appendChild(btnGroup);
                }

                // if (visitedPois.has(poiId)) {
                //     li.classList.add('visited');
                // }
                poiList.appendChild(li);
            }
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
                const color = '#3388ff';
                const line = L.polyline([[startPoi.lat, startPoi.lon], [endPoi.lat, endPoi.lon]], {
                    color: color,
                    weight: 3,
                    opacity: 0.7
                }).addTo(map);
                routePolylines.push(line);
            }
        }
    }

    function onMapClick(e) {
        if (!isEditMode) return;
        const { lat, lng } = e.latlng;

        const formHTML = `
            <form id="poi-form">
                <input type="hidden" name="lat" value="${lat}">
                <input type="hidden" name="lon" value="${lng}">
                <div class="form-group">
                    <label for="name">POI Name</label>
                    <input type="text" name="name" id="name" required>
                </div>
                <div class="form-group">
                    <label for="description">Description</label>
                    <textarea name="description" id="description" rows="3"></textarea>
                </div>
                <button type="submit" class="btn-modern btn-modern-primary">Add POI</button>
            </form>
        `;

        showFormModal('Add New Point of Interest', formHTML, (data) => {
            const newPoi = {
                id: `temp-${Date.now()}`, // Temporary ID
                lat: parseFloat(data.lat),
                lon: parseFloat(data.lon),
                name: data.name,
                description: data.description,
                texts: { [currentLang]: { name: data.name, description: data.description } }
            };
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

        const formHTML = `
            <form id="poi-form">
                <div class="form-group">
                    <label for="name">POI Name</label>
                    <input type="text" name="name" id="name" value="${poi.name}" required>
                </div>
                <div class="form-group">
                    <label for="description">Description</label>
                    <textarea name="description" id="description" rows="3">${poi.description}</textarea>
                </div>
                <button type="submit" class="btn-modern btn-modern-primary">Save Changes</button>
            </form>
        `;

        showFormModal('Edit Point of Interest', formHTML, (data) => {
            poi.name = data.name;
            poi.description = data.description;
            if (poi.texts[currentLang]) {
                poi.texts[currentLang].name = data.name;
                poi.texts[currentLang].description = data.description;
            }
            renderPois();
            renderPoiList();
            return true;
        });
    }

    function deletePoi(poiId) {
        if (!confirm("Are you sure you want to delete this POI?")) return;
        pois = pois.filter(p => p.id !== poiId);
        tourRoute = tourRoute.filter(id => id !== poiId);
        renderPois();
        renderPoiList();
        drawTourRoute();
    }
    }

    async function createNewGuide() {
        const formHTML = `
            <form id="new-guide-form">
                <div class="form-group">
                    <label for="title">Title</label>
                    <input type="text" name="title" id="title" required>
                </div>
                <div class="form-group">
                    <label for="slug">URL Slug</label>
                    <input type="text" name="slug" id="slug" required pattern="[a-z0-9-]+">
                    <small>e.g., 'my-awesome-guide-slug'</small>
                </div>
                <div class="form-group">
                    <label for="summary">Summary</label>
                    <textarea name="summary" id="summary" rows="3"></textarea>
                </div>
                <button type="submit" class="btn-modern btn-modern-primary">Create Guide</button>
            </form>
        `;

        showFormModal('Create a New Guide', formHTML, async (data) => {
            const { data: guideData, error } = await supabase
                .from('guides')
                .insert({
                    ...data,
                    language: 'es', // Default language
                    author_id: currentUser.id,
                    status: 'draft',
                    initial_lat: map.getCenter().lat,
                    initial_lon: map.getCenter().lng,
                    initial_zoom: map.getZoom()
                })
                .select()
                .single();

            if (error) {
                alert(`Error creating guide: ${error.message}`);
                return false; // Keep modal open
            }

            loadGuide(guideData.slug).then(() => {
                setMode('edit');
            });
            return true; // Close modal
        });
    }

    async function saveGuide() {
        if (!currentGuide) {
            alert("Error: No guide is currently loaded. Please create a new guide first.");
            return;
        }

        const sectionsToSave = pois.map((poi, index) => ({
            guide_id: currentGuide.id,
            title: poi.name,
            body_md: poi.description,
            lat: poi.lat,
            lon: poi.lon,
            order: index,
            ...(poi.id.toString().startsWith('temp-') ? {} : { id: poi.id })
        }));

        // Upsert all sections
        const { error } = await supabase.from('guide_sections').upsert(sectionsToSave);

        if (error) {
            alert('Error saving guide sections.');
            console.error(error);
        } else {
            alert('Guide saved successfully!');
            // Reload guide to get new IDs
            loadGuide(currentGuide.slug);
        }
    }


    init();
});
