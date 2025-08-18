/*
 * WayWhispery - Redesigned Application
 * Author: Alberto Arce (Original)
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
    const activityMapBtn = document.getElementById('activity-map-btn');
    const sidebarLogo = document.getElementById('sidebar-logo');
    const sidebarViewTitle = document.getElementById('sidebar-view-title');
    const sidebarHeaderControls = document.getElementById('sidebar-header-controls');
    const sidebarGuidesView = document.getElementById('sidebar-guides-view');
    const sidebarMapView = document.getElementById('sidebar-map-view');

    // Auth
    const authContainer = document.getElementById('auth-container-activity');

    // Guides View
    const guideCatalogList = document.getElementById('guide-catalog-list');

    // Map View
    const guideMetaContainer = document.getElementById('guide-meta-container');
    const authorNameSpan = document.getElementById('author-name');
    const poiList = document.getElementById('poi-list');
    const languageSelector = document.getElementById('language-selector');

    // Map Overlays & Controls
    const guideTextOverlay = document.getElementById('guide-text-overlay');
    const guideTextP = guideTextOverlay.querySelector('p');
    const controlsContainer = document.getElementById('controls');
    const liveModeToggle = document.getElementById('live-mode-toggle');
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');

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
    let userMarker;
    let geolocationId;
    let lastTriggeredPoiId = null;
    const PROXIMITY_THRESHOLD = 20; // meters

    // TTS
    const synth = window.speechSynthesis;
    let utterance = new SpeechSynthesisUtterance();

    const introPhrases = {
        en: ["You have arrived at", "You are now at", "This is"],
        es: ["Has llegado a", "Te encuentras en", "Esto es"],
        fr: ["Vous êtes arrivé à", "Vous êtes maintenant à", "Voici"],
        de: ["Sie sind angekommen bei", "Sie befinden sich jetzt bei", "Das ist"],
        zh: ["您已到达", "您现在在", "这里是"]
    };

    // State
    let currentGuide = null;
    let pois = [];
    let tourRoute = [];
    let visitedPois = new Set();
    let breadcrumbPath = [];
    let breadcrumbLayer = null;
    let currentUser = null;
    let userProfile = null;
    let isEditMode = false;
    let selectedLanguage = null;
    let poisToDelete = [];

    // -----------------------------------------------------------------------------
    // Layout & UI Logic
    // -----------------------------------------------------------------------------
    const isMobile = () => window.innerWidth <= 768;

    function setupEventListeners() {
        // Main layout
        sidebarLogo.addEventListener('click', () => switchSidebarView('guides'));
        activityMapBtn.addEventListener('click', () => switchSidebarView('map'));

        // Modals
        formModalCloseBtn.onclick = () => hideFormModal();

        // File import
        document.getElementById('import-file-input').addEventListener('change', handleFileUpload);

        // Live Mode & TTS Controls
        liveModeToggle.addEventListener('change', () => {
            if (liveModeToggle.checked) {
                startGpsTracking();
                controlsContainer.classList.remove('hidden');
            } else {
                stopGpsTracking();
                controlsContainer.classList.add('hidden');
                guideTextOverlay.classList.add('hidden');
            }
        });

        playBtn.addEventListener('click', () => {
            if (synth.paused) { synth.resume(); }
            else if (lastTriggeredPoiId) {
                const poi = pois.find(p => p.id === lastTriggeredPoiId);
                if (poi) speak(poi.description);
            }
        });
        pauseBtn.addEventListener('click', () => { if (synth.speaking) synth.pause(); });
        stopBtn.addEventListener('click', () => { if (synth.speaking) synth.cancel(); });
    }

    function switchSidebarView(viewName) {
        const sidebar = document.querySelector('.sidebar');
        const newActiveBtn = viewName === 'map' ? activityMapBtn : sidebarLogo;
        const isAlreadyActive = newActiveBtn.classList.contains('active');

        // If the clicked button's view is already active, just toggle visibility
        if (isAlreadyActive) {
            sidebar.classList.toggle('collapsed');
            return;
        }

        activityMapBtn.classList.remove('active');
        sidebarLogo.classList.remove('active');
        newActiveBtn.classList.add('active');

        if (viewName === 'guides') {
            sidebarGuidesView.classList.add('active');
            sidebarMapView.classList.remove('active');
            sidebarViewTitle.textContent = 'All Guides';
        } else if (viewName === 'map') {
            sidebarGuidesView.classList.remove('active');
            sidebarMapView.classList.add('active');
            sidebarViewTitle.textContent = currentGuide?.title || 'Guide Details';
        }

        sidebar.classList.remove('collapsed');
        updateHeaderControls();
    }

    function updateUIforAuth() {
        const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';
        if (currentUser) {
            authContainer.innerHTML = `
                <div class="user-profile-container">
                    <span class="user-email">${currentUser.email}</span>
                    <button id="logout-btn" class="activity-btn" title="Logout"><i class="fas fa-sign-out-alt"></i></button>
                </div>`;
            authContainer.querySelector('#logout-btn').addEventListener('click', logout);
        } else {
            authContainer.innerHTML = `<button id="login-btn" class="activity-btn" title="Login"><i class="fas fa-sign-in-alt"></i></button>`;
            authContainer.querySelector('#login-btn').addEventListener('click', loginWithGoogle);
        }
        updateHeaderControls();
    }

    function updateSplashAuthUI() {
        const splashFooter = document.querySelector('.splash-footer');
        if (currentUser && splashFooter) {
            const authContainer = splashFooter.querySelector('.splash-auth-container');
            if (authContainer) {
                authContainer.innerHTML = `
                    <div class="user-profile-container">
                        <span class="user-email">${currentUser.email}</span>
                        <button id="splash-logout-btn" class="btn-modern btn-modern-secondary"><i class="fas fa-sign-out-alt"></i> Logout</button>
                    </div>`;
                splashFooter.querySelector('#splash-logout-btn').addEventListener('click', logout);
            }
        }
    }

    function updateMapView() {
        if (currentGuide) {
            sidebarViewTitle.textContent = currentGuide.title;
            authorNameSpan.textContent = currentGuide.author?.email || 'Unknown';
            guideMetaContainer.classList.remove('hidden');
            renderPoiList();
            renderPois();
            drawTourRoute();
        } else {
            sidebarViewTitle.textContent = 'All Guides';
            authorNameSpan.textContent = '';
            guideMetaContainer.classList.add('hidden');
            poiList.innerHTML = '';
        }
        updateHeaderControls();
        setMode('view');
    }

    // -----------------------------------------------------------------------------
    // Map Logic & GPS / TTS
    // -----------------------------------------------------------------------------
    function initializeMap() {
        map = L.map('map-container').setView([40.4167, -3.7038], 5); // Default to Spain
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
    }

    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI/180; const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180; const Δλ = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    function speak(text) {
        if (synth.speaking) synth.cancel();
        utterance.text = text;
        // utterance.lang = 'es-ES'; // This should be set based on guide lang
        synth.speak(utterance);
    }

    function updateGuideText(text) {
        guideTextOverlay.classList.remove('hidden');
        guideTextP.textContent = text;
    }

    function startGpsTracking() {
        if (geolocationId) navigator.geolocation.clearWatch(geolocationId);
        if (navigator.geolocation) {
            geolocationId = navigator.geolocation.watchPosition(showPosition,
                (err) => { alert(`GPS Error: ${err.message}`); },
                { enableHighAccuracy: true }
            );
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    }

    function stopGpsTracking() {
        if (geolocationId) {
            navigator.geolocation.clearWatch(geolocationId);
            geolocationId = null;
        }
        if(userMarker) {
            userMarker.remove();
            userMarker = null;
        }
        // Clear breadcrumbs when stopping GPS
        breadcrumbPath = [];
        if (breadcrumbLayer) {
            breadcrumbLayer.remove();
        }
    }

    function showPosition(position) {
        const { latitude: lat, longitude: lon } = position.coords;
        if (!userMarker) {
            createUserMarker(lat, lon);
        } else {
            userMarker.setLatLng([lat, lon]);
        }

        // Add to breadcrumb path every 10 meters
        const lastBreadcrumb = breadcrumbPath[breadcrumbPath.length - 1];
        if (!lastBreadcrumb || getDistance(lat, lon, lastBreadcrumb[0], lastBreadcrumb[1]) > 10) {
            breadcrumbPath.push([lat, lon]);
            drawBreadcrumbs();
        }

        checkProximity(lat, lon);
    }

    function createUserMarker(lat, lon) {
        const userIcon = L.divIcon({
            html: '<div style="background-color: blue; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
            className: '',
            iconSize: [15, 15],
            iconAnchor: [9, 9]
        });
        userMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map);
    }

    function drawBreadcrumbs() {
        if (breadcrumbLayer) {
            breadcrumbLayer.remove();
        }
        const breadcrumbMarkers = breadcrumbPath.map(pos =>
            L.circleMarker(pos, { radius: 2, color: '#ff0000', fillColor: '#ff0000', fillOpacity: 0.8 })
        );
        breadcrumbLayer = L.layerGroup(breadcrumbMarkers).addTo(map);
    }

    function checkProximity(lat, lon) {
        if (!pois || pois.length === 0) return;

        let closestPoi = pois.reduce((closest, poi) => {
            const distance = getDistance(lat, lon, poi.lat, poi.lon);
            if (distance < closest.distance) return { ...poi, distance };
            return closest;
        }, { distance: Infinity });

        const inRangeOfPoi = closestPoi.distance < PROXIMITY_THRESHOLD ? closestPoi : null;
        const newTriggerId = inRangeOfPoi ? inRangeOfPoi.id : null;

        if (newTriggerId && newTriggerId !== lastTriggeredPoiId) {
            lastTriggeredPoiId = newTriggerId;

            // Mark as visited and update UI
            visitedPois.add(newTriggerId);
            renderPoiList();
            drawTourRoute();

            const intros = introPhrases[currentGuide?.language || 'en'] || introPhrases.en;
            const randomIntro = intros[Math.floor(Math.random() * intros.length)];
            const fullDescription = `${randomIntro} ${inRangeOfPoi.name}. ${inRangeOfPoi.description}`;

            updateGuideText(fullDescription);
            speak(fullDescription);
            poiMarkers[newTriggerId]?.openPopup();
        } else if (!newTriggerId && lastTriggeredPoiId) {
            lastTriggeredPoiId = null;
        }
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
                const isVisited = visitedPois.has(endPoi.id);
                const color = isVisited ? '#66CDAA' : '#3388ff';
                const line = L.polyline([[startPoi.lat, startPoi.lon], [endPoi.lat, endPoi.lon]], { color: color, weight: 3, opacity: 0.7 }).addTo(map);
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
        if (!selectedLanguage) {
            guideCatalogList.innerHTML = '<p>Select a language from the splash screen to see available guides.</p>';
            return;
        }

        const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';
        // Security Note: Supabase client library uses parameterized queries, preventing SQL injection.
        // The RLS policies defined in the database provide row-level access control.
        let query = supabase.from('guides')
            .select('slug, details, default_lang, available_langs')
            .contains('available_langs', `{${selectedLanguage}}`); // Filter by selected language

        // Editors can see their own drafts, everyone can see published guides
        if (isEditor && currentUser) {
            query = query.or(`author_id.eq.${currentUser.id},status.eq.published`);
        } else {
            query = query.eq('status', 'published');
        }

        const { data: guides, error } = await query;

        if (error) {
            console.error("Error fetching guides:", error);
            guideCatalogList.innerHTML = `<p>Error loading guides.</p>`;
            return;
        }
        if (!guides || guides.length === 0) {
            guideCatalogList.innerHTML = `<p>No guides found for the selected language.</p>`;
            return;
        }

        guideCatalogList.innerHTML = '';
        guides.forEach(guide => {
            const card = document.createElement('div');
            card.className = 'card';

            let details_obj = guide.details;
            if (typeof details_obj === 'string') {
                try {
                    details_obj = JSON.parse(details_obj);
                } catch (e) {
                    console.error('Error parsing guide details:', e);
                    details_obj = {};
                }
            }

            // Use the selected language for display, fallback to default, then first available
            const guideDetails = details_obj?.[selectedLanguage] || details_obj?.[guide.default_lang] || details_obj?.[Object.keys(details_obj || {})[0]] || { title: 'Untitled', summary: '' };

            const title = guideDetails.title;
            const summary = guideDetails.summary;

            card.innerHTML = `<h5 class="card-title">${title}</h5><p class="card-text">${summary || ''}</p>`;
            card.addEventListener('click', () => loadGuide(guide.slug));
            guideCatalogList.appendChild(card);
        });
    }

    async function loadGuide(slug) {
        const { data: guideData, error } = await supabase.from('guides').select('*, author:profiles(email)').eq('slug', slug).single();
        if (error || !guideData) {
            alert(`Error loading guide: ${error?.message || 'Guide not found.'}`);
            return;
        }
        const { data: sectionsData, error: sectionsError } = await supabase.from('guide_sections').select('*').eq('guide_id', guideData.id).order('order');
        if (sectionsError) {
            alert(`Error loading guide sections: ${sectionsError.message}`);
            return;
        }
        currentGuide = guideData;
        // The raw POI data now contains the JSONB 'texts' field
        pois = sectionsData;
        tourRoute = pois.map(p => p.id);

        populateLanguageSelector();
        switchLanguage(currentGuide.default_lang); // Switch to default language

        map.setView([currentGuide.initial_lat, currentGuide.initial_lon], currentGuide.initial_zoom);
        updateMapView();
        switchSidebarView('map');

        if (isMobile()) {
            document.querySelector('.sidebar').classList.remove('active');
        }
    }

    function populateLanguageSelector() {
        languageSelector.innerHTML = '';
        const langMap = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', zh: '中文' };
        currentGuide.available_langs.forEach(langCode => {
            const option = document.createElement('option');
            option.value = langCode;
            option.textContent = langMap[langCode] || langCode;
            languageSelector.appendChild(option);
        });
        languageSelector.addEventListener('change', (e) => switchLanguage(e.target.value));
    }

    function switchLanguage(langCode) {
        // Update the current language state
        currentGuide.current_lang = langCode;
        languageSelector.value = langCode;

        // Safely parse guide details
        let guideDetailsObj = currentGuide.details;
        if (typeof guideDetailsObj === 'string') {
            try { guideDetailsObj = JSON.parse(guideDetailsObj); } catch (e) { guideDetailsObj = {}; }
        }
        const firstGuideLang = Object.keys(guideDetailsObj)[0];
        const guideDetails = guideDetailsObj?.[langCode] || guideDetailsObj?.[currentGuide.default_lang] || guideDetailsObj?.[firstGuideLang] || {};
        currentGuide.title = guideDetails.title || 'Untitled Guide';
        currentGuide.summary = guideDetails.summary || '';

        // Safely parse POI texts
        pois.forEach(poi => {
            let poiTextsObj = poi.texts;
            if (typeof poiTextsObj === 'string') {
                try { poiTextsObj = JSON.parse(poiTextsObj); } catch (e) { poiTextsObj = {}; }
            }
            const firstPoiLang = Object.keys(poiTextsObj)[0];
            const poiTexts = poiTextsObj?.[langCode] || poiTextsObj?.[currentGuide.default_lang] || poiTextsObj?.[firstPoiLang] || {};
            poi.name = poiTexts.title || 'Untitled POI';
            poi.description = poiTexts.description || '';
        });

        // Update utterance language for TTS
        const ttsLangMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', zh: 'zh-CN' };
        utterance.lang = ttsLangMap[langCode] || 'en-US';

        // Re-render the UI
        updateMapView();
    }

    // -----------------------------------------------------------------------------
    // Edit Mode & CRUD
    // -----------------------------------------------------------------------------
    function updateHeaderControls() {
        sidebarHeaderControls.innerHTML = '';
        const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';
        if (!isEditor) return;

        const currentView = sidebarGuidesView.classList.contains('active') ? 'guides' : 'map';

        if (currentView === 'guides') {
            const createBtn = document.createElement('button');
            createBtn.className = 'btn-modern btn-modern-sm';
            createBtn.innerHTML = '<i class="fas fa-plus"></i> New';
            createBtn.onclick = createNewGuide;
            sidebarHeaderControls.appendChild(createBtn);
        } else if (currentView === 'map' && currentGuide) {
            setMode(isEditMode ? 'edit' : 'view'); // Re-render controls for map view
        }
    }

    function setMode(mode) {
        isEditMode = mode === 'edit';
        sidebarHeaderControls.innerHTML = ''; // Clear existing controls
        const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';
        if (!isEditor || !currentGuide) return;

        if (isEditMode) {
            // POI Edit Mode
            map.on('click', onMapClick);
            sidebarHeaderControls.innerHTML = `
                <button id="save-guide-btn" class="btn-modern btn-modern-sm" title="Save Changes"><i class="fas fa-save"></i></button>
                <button id="exit-edit-btn" class="btn-modern btn-modern-sm btn-modern-secondary" title="Exit POI Edit Mode"><i class="fas fa-times"></i></button>
                <hr>
                <button id="export-guide-btn" class="btn-modern btn-modern-sm btn-modern-secondary" title="Export JSON"><i class="fas fa-file-export"></i></button>
                <button id="import-guide-btn" class="btn-modern btn-modern-sm btn-modern-secondary" title="Import JSON"><i class="fas fa-file-import"></i></button>
                <button id="translate-guide-btn" class="btn-modern btn-modern-sm btn-modern-secondary" title="Auto-translate"><i class="fas fa-language"></i></button>
            `;
            sidebarHeaderControls.querySelector('#save-guide-btn').onclick = saveGuide;
            sidebarHeaderControls.querySelector('#export-guide-btn').onclick = exportForTranslation;
            sidebarHeaderControls.querySelector('#import-guide-btn').onclick = () => document.getElementById('import-file-input').click();
            sidebarHeaderControls.querySelector('#translate-guide-btn').onclick = showAutoTranslateModal;
            sidebarHeaderControls.querySelector('#exit-edit-btn').onclick = () => setMode('view');
        } else {
            // View Mode with options for editors
            map.off('click', onMapClick);
            sidebarHeaderControls.innerHTML = `
                <button id="edit-guide-details-btn" class="btn-modern btn-modern-sm" title="Edit Guide Details"><i class="fas fa-cog"></i></button>
                <button id="edit-pois-btn" class="btn-modern btn-modern-sm" title="Edit POIs"><i class="fas fa-map-marker-alt"></i></button>
            `;
            sidebarHeaderControls.querySelector('#edit-guide-details-btn').onclick = showGuideDetailsForm;
            sidebarHeaderControls.querySelector('#edit-pois-btn').onclick = () => setMode('edit');
        }
        renderPois();
        renderPoiList();
    }

    function renderPoiList() {
        poiList.innerHTML = '';
        pois.forEach(poi => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.dataset.poiId = poi.id;
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
            if (visitedPois.has(poi.id)) {
                li.classList.add('visited');
            }
            poiList.appendChild(li);
        });

        // Add event listeners after rendering
        poiList.querySelectorAll('.list-group-item').forEach(item => item.addEventListener('click', (e) => {
            if (e.target.closest('.btn-group')) return; // Don't fire if clicking buttons
            flyToPoi(e.currentTarget.dataset.poiId);
        }));
        poiList.querySelectorAll('.edit-poi-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent li click from firing
            editPoi(e.currentTarget.dataset.id);
        }));
        poiList.querySelectorAll('.delete-poi-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent li click from firing
            deletePoi(e.currentTarget.dataset.id);
        }));
    }

    function flyToPoi(poiId) {
        const poi = pois.find(p => p.id === poiId);
        if (!poi) return;

        map.flyTo([poi.lat, poi.lon], 17); // Zoom in closer

        const marker = poiMarkers[poi.id];
        if (marker) {
            marker.openPopup();
        }

        // Trigger text and speech
        const intros = introPhrases[currentGuide?.language || 'en'] || introPhrases.en;
        const randomIntro = intros[Math.floor(Math.random() * intros.length)];
        const fullDescription = `${randomIntro} ${poi.name}. ${poi.description}`;

        updateGuideText(fullDescription);
        speak(fullDescription);

        // Mark as visited and update UI
        visitedPois.add(poiId);
        renderPoiList();
        drawTourRoute();

        if (isMobile()) {
            document.querySelector('.sidebar').classList.remove('active');
        }
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

        const lang = currentGuide.current_lang || currentGuide.default_lang;
        const texts = poi.texts[lang] || { title: '', description: '' };

        showFormModal(`Edit POI (in ${lang.toUpperCase()})`, `
            <form>
                <div class="form-group">
                    <label for="name">Name</label>
                    <input type="text" name="name" value="${texts.title}" required>
                </div>
                <div class="form-group">
                    <label for="description">Description</label>
                    <textarea name="description" rows="3">${texts.description}</textarea>
                </div>
                <button type="submit" class="btn-modern">Save Changes</button>
            </form>`, (data) => {
            // Ensure the texts object for the language exists
            if (!poi.texts[lang]) {
                poi.texts[lang] = {};
            }
            // Update the JSONB texts object for the specific language
            poi.texts[lang].title = data.name;
            poi.texts[lang].description = data.description;

            // Also update the top-level properties for immediate UI refresh
            poi.name = data.name;
            poi.description = data.description;

            // Re-render the list to show the new name
            renderPoiList();
            // No need to re-render all POI markers on the map unless their position changes
            return true;
        });
    }

    function deletePoi(poiId) {
        if (!confirm('Are you sure?')) return;
        // If the POI has a real ID (not a temp one), mark it for deletion.
        if (!poiId.startsWith('temp-')) {
            poisToDelete.push(poiId);
        }
        pois = pois.filter(p => p.id !== poiId);
        tourRoute = tourRoute.filter(id => id !== poiId);
        renderPois();
        renderPoiList();
        drawTourRoute();
    }

    async function createNewGuide() {
        showFormModal('Create New Guide', `
            <form>
                <div class="form-group"><label for="title">Title (in ${selectedLanguage.toUpperCase()})</label><input type="text" name="title" required></div>
                <div class="form-group"><label for="slug">URL Slug</label><input type="text" name="slug" required pattern="[a-z0-9-]+" placeholder="e.g. my-cool-guide"></div>
                <div class="form-group"><label for="summary">Summary (in ${selectedLanguage.toUpperCase()})</label><textarea name="summary" rows="3"></textarea></div>
                <button type="submit" class="btn-modern">Create and Edit</button>
            </form>`, async (data) => {
            if (!selectedLanguage) {
                alert("A language must be selected to create a guide.");
                return false;
            }

            const newGuideData = {
                slug: data.slug,
                author_id: currentUser.id,
                status: 'draft',
                initial_lat: map.getCenter().lat,
                initial_lon: map.getCenter().lng,
                initial_zoom: map.getZoom(),
                default_lang: selectedLanguage,
                available_langs: [selectedLanguage],
                details: {
                    [selectedLanguage]: {
                        title: data.title,
                        summary: data.summary
                    }
                }
            };

            const { data: guideData, error } = await supabase.from('guides').insert(newGuideData).select().single();
            if (error) {
                alert(`Error creating guide: ${error.message}`);
                return false;
            }
            await loadGuide(guideData.slug);
            setMode('edit');
            return true;
        });
    }

    async function saveGuide() {
        // 1. Delete POIs that were marked for deletion
        if (poisToDelete.length > 0) {
            const { error: deleteError } = await supabase.from('guide_sections').delete().in('id', poisToDelete);
            if (deleteError) {
                alert(`Error deleting POIs: ${deleteError.message}`);
                return; // Stop if deletion fails
            }
            poisToDelete = []; // Clear the array after successful deletion
        }

        // 2. Upsert (insert or update) the remaining POIs
        const sectionsToSave = pois.map((poi, index) => {
            // This needs to be adapted for the new multi-language structure
            const poiData = {
                guide_id: currentGuide.id,
                texts: poi.texts, // Assuming poi.texts is the JSONB object
                lat: poi.lat,
                lon: poi.lon,
                order: index
            };
            if (!poi.id.toString().startsWith('temp-')) {
                poiData.id = poi.id;
            }
            return poiData;
        });

        const { error: upsertError } = await supabase.from('guide_sections').upsert(sectionsToSave);
        if (upsertError) {
            alert(`Error saving guide sections: ${upsertError.message}`);
        } else {
            alert('Guide saved successfully!');
            await loadGuide(currentGuide.slug); // Reload to get fresh data
        }
    }

    function showGuideDetailsForm() {
        if (!currentGuide) return;
        const lang = currentGuide.current_lang || currentGuide.default_lang;
        const details = currentGuide.details[lang] || { title: '', summary: '' };

        const formHTML = `
            <form>
                <div class="form-group">
                    <label for="title">Title (in ${lang.toUpperCase()})</label>
                    <input type="text" name="title" value="${details.title}" required>
                </div>
                <div class="form-group">
                    <label for="summary">Summary (in ${lang.toUpperCase()})</label>
                    <textarea name="summary" rows="4">${details.summary}</textarea>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-modern">Save Details</button>
                    <button type="button" id="delete-guide-btn" class="btn-modern btn-modern-danger">Delete Guide</button>
                </div>
            </form>
        `;

        showFormModal('Edit Guide Details', formHTML, async (data) => {
            // Update logic
            const newDetails = { ...currentGuide.details };
            newDetails[lang] = { title: data.title, summary: data.summary };

            const { error } = await supabase.from('guides')
                .update({ details: newDetails })
                .eq('id', currentGuide.id);

            if (error) {
                alert(`Error updating guide: ${error.message}`);
                return false;
            } else {
                alert('Guide details saved!');
                await loadGuide(currentGuide.slug); // Reload to see changes
                return true;
            }
        });

        // Add event listener for the delete button *after* the modal is shown
        document.getElementById('delete-guide-btn').addEventListener('click', deleteGuide);
    }

    async function deleteGuide() {
        if (!currentGuide) return;
        if (!confirm(`Are you absolutely sure you want to delete the guide "${currentGuide.title}"? This action cannot be undone.`)) return;

        const { error } = await supabase.from('guides').delete().eq('id', currentGuide.id);

        if (error) {
            alert(`Error deleting guide: ${error.message}`);
        } else {
            alert('Guide deleted successfully.');
            window.location.reload(); // Reload the app to go back to the guide list
        }
    }

    function exportForTranslation() {
        if (!currentGuide) return;

        const langToExport = currentGuide.current_lang || currentGuide.default_lang;
        const translationTemplate = {
            guide: {
                title: currentGuide.details[langToExport]?.title || '',
                summary: currentGuide.details[langToExport]?.summary || ''
            },
            pois: {}
        };

        pois.forEach(poi => {
            translationTemplate.pois[poi.id] = {
                title: poi.texts[langToExport]?.title || '',
                description: poi.texts[langToExport]?.description || ''
            };
        });

        downloadJson(translationTemplate, `${currentGuide.slug}-${langToExport}-translation.json`);
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const targetLang = prompt("Enter the 2-letter language code for this translation (e.g., 'es', 'fr'):");
        if (!targetLang || targetLang.length !== 2) {
            alert("Invalid language code.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                applyTranslation(importedData, targetLang.toLowerCase());
            } catch (error) {
                alert(`Error parsing JSON file: ${error.message}`);
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset input
    }

    function showAutoTranslateModal() {
        const langMap = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', zh: '中文' };
        const availableLangs = new Set(currentGuide.available_langs);
        let optionsHTML = '';
        for (const [code, name] of Object.entries(langMap)) {
            if (!availableLangs.has(code)) {
                optionsHTML += `<option value="${code}">${name}</option>`;
            }
        }

        if (!optionsHTML) {
            alert("This guide has already been translated into all supported languages.");
            return;
        }

        const formHTML = `
            <p>Translate from <strong>${currentGuide.default_lang.toUpperCase()}</strong> to:</p>
            <form>
                <div class="form-group">
                    <select name="targetLang" class="form-select">${optionsHTML}</select>
                </div>
                <button type="submit" class="btn-modern">Translate</button>
            </form>
            <p class="text-muted small">Note: Auto-translation is a tool. Please review results before saving.</p>
        `;
        showFormModal('Auto-translate Guide', formHTML, (data) => {
            runAutoTranslation(data.targetLang);
            return true;
        });
    }

    async function runAutoTranslation(targetLang) {
        if (!currentGuide) return;
        const sourceLang = currentGuide.default_lang;
        const translatedData = { guide: {}, pois: {} };
        const textToTranslate = [];

        // Gather all text
        const guideDetails = currentGuide.details[sourceLang] || {};
        textToTranslate.push(guideDetails.title || '');
        textToTranslate.push(guideDetails.summary || '');
        pois.forEach(poi => {
            const poiTexts = poi.texts[sourceLang] || {};
            textToTranslate.push(poiTexts.title || '');
            textToTranslate.push(poiTexts.description || '');
        });

        // Show loader
        showFormModal('Translating...', '<div class="loader"></div>', () => {});

        try {
            const translations = await Promise.all(textToTranslate.map(text =>
                fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`)
                .then(res => res.json())
                .then(data => data.responseData.translatedText)
            ));

            // Reconstruct the data
            translatedData.guide.title = translations.shift();
            translatedData.guide.summary = translations.shift();
            pois.forEach(poi => {
                translatedData.pois[poi.id] = {
                    title: translations.shift(),
                    description: translations.shift()
                };
            });

            applyTranslation(translatedData, targetLang);
            hideFormModal(); // Hide loader
            alert(`Translation to ${targetLang.toUpperCase()} complete. Please review the changes and save the guide.`);

        } catch (error) {
            hideFormModal();
            alert(`Translation failed: ${error.message}`);
        }
    }

    function applyTranslation(data, lang) {
        // Update guide details
        if (!currentGuide.details[lang]) currentGuide.details[lang] = {};
        currentGuide.details[lang].title = data.guide.title;
        currentGuide.details[lang].summary = data.guide.summary;

        // Update POI texts
        pois.forEach(poi => {
            if (data.pois[poi.id]) {
                if (!poi.texts[lang]) poi.texts[lang] = {};
                poi.texts[lang].title = data.pois[poi.id].title;
                poi.texts[lang].description = data.pois[poi.id].description;
            }
        });

        // Add new language to available_langs
        if (!currentGuide.available_langs.includes(lang)) {
            currentGuide.available_langs.push(lang);
        }

        // Refresh UI
        populateLanguageSelector();
        switchLanguage(lang);
        updateMapView();
    }

    function downloadJson(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // -----------------------------------------------------------------------------
    // Modal System
    // -----------------------------------------------------------------------------
    function showFormModal(title, formHTML, submitCallback) {
        formModalTitle.textContent = title;
        formModalContent.innerHTML = formHTML;
        formModal.classList.remove('hidden');
        const form = formModalContent.querySelector('form');
        if (form) {
            function handleSubmit(e) {
                e.preventDefault();
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                if (submitCallback(data)) { hideFormModal(); }
            }
            form.addEventListener('submit', handleSubmit);
        }
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
        const splashScreen = document.getElementById('splash-screen');
        const splashLoader = document.getElementById('splash-loader');
        const languageFlags = document.querySelectorAll('.flag-icon');
        const splashLoginBtn = document.getElementById('splash-login-btn');

        const startApp = async (lang) => {
            selectedLanguage = lang;
            splashLoader.classList.remove('hidden');

            try {
                initializeMap();
                setupEventListeners();

                // Set up auth listeners first
                supabase.auth.onAuthStateChange(async (event, session) => {
                    currentUser = session?.user || null;
                    userProfile = currentUser ? await getProfile(currentUser.id) : null;
                    updateUIforAuth();
                });

                // Get initial session
                const { data: { session } } = await supabase.auth.getSession();
                currentUser = session?.user || null;
                userProfile = currentUser ? await getProfile(currentUser.id) : null;
                updateUIforAuth();
                updateSplashAuthUI();

                // Fetch content
                await fetchAndDisplayGuides();
                updateMapView();

                // Hide splash screen after loading is complete
                splashScreen.classList.add('hidden');

            } catch (error) {
                console.error("Error during initialization:", error);
                alert("An error occurred while loading the application. Please try refreshing the page.");
                splashLoader.classList.add('hidden'); // Hide loader on error
            }
        };

        languageFlags.forEach(flag => {
            flag.addEventListener('click', () => {
                const lang = flag.dataset.lang;
                startApp(lang);
            });
        });

        if (splashLoginBtn) {
            splashLoginBtn.addEventListener('click', loginWithGoogle);
        }
    }

    // Replace direct call with DOMContentLoaded
    init();
    //document.addEventListener('DOMContentLoaded', init);

});

