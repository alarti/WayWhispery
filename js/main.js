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
    const logoBtn = document.getElementById('logo-btn');
    const langBtn = document.getElementById('lang-btn');
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
    let allFetchedGuides = []; // To store guides for client-side filtering
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
        logoBtn.addEventListener('click', () => switchSidebarView('guides'));
        activityMapBtn.addEventListener('click', () => switchSidebarView('map'));
        langBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('lang-menu').classList.toggle('visible');
        });

        // Search listener
        document.getElementById('guide-search-input').addEventListener('input', (e) => {
            renderGuideList(e.target.value.toLowerCase());
        });

        // Modals
        formModalCloseBtn.onclick = () => hideFormModal();

        // Close user menus if clicking outside
        window.addEventListener('click', (event) => {
            if (!event.target.closest('.dropdown-container')) {
                document.querySelectorAll('.dropdown-menu.visible').forEach(menu => menu.classList.remove('visible'));
            }
        });

        document.getElementById('import-guides-input').addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    importGuides(e.target.result);
                } catch (error) {
                    alert(`Error parsing JSON file: ${error.message}`);
                }
            };
            reader.readAsText(file);
            event.target.value = ''; // Reset input
        });

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
        const newActiveBtn = viewName === 'map' ? activityMapBtn : logoBtn;
        const isAlreadyActive = newActiveBtn.classList.contains('active');

        // If the clicked button's view is already active, just toggle visibility
        if (isAlreadyActive) {
            sidebar.classList.toggle('collapsed');
            return;
        }

        activityMapBtn.classList.remove('active');
        logoBtn.classList.remove('active');
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
        if (currentUser) {
            authContainer.innerHTML = `
                <div class="dropdown-container">
                    <button class="activity-btn" id="user-menu-btn" title="User Menu"><i class="fas fa-user-circle"></i></button>
                    <div class="dropdown-menu" id="main-user-menu">
                        <div class="user-email">${currentUser.email}</div>
                        <button class="logout-btn"><i class="fas fa-sign-out-alt"></i> Logout</button>
                    </div>
                </div>`;

            authContainer.querySelector('#user-menu-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('main-user-menu').classList.toggle('visible');
            });
            authContainer.querySelector('.logout-btn').addEventListener('click', logout);

        } else {
            authContainer.innerHTML = `<button id="login-btn" class="activity-btn" title="Login"><i class="fas fa-sign-in-alt"></i></button>`;
            authContainer.querySelector('#login-btn').addEventListener('click', loginWithGoogle);
        }
        updateHeaderControls();
    }

    function updateSplashAuthUI() {
        const splashFooter = document.querySelector('.splash-footer');
        const authContainer = splashFooter?.querySelector('.splash-auth-container');
        if (!authContainer) return;

        if (currentUser) {
            authContainer.innerHTML = `
                <div class="dropdown-container">
                    <button class="btn-modern btn-modern-secondary" id="splash-user-menu-btn" title="User Menu"><i class="fas fa-user-circle"></i></button>
                    <div class="dropdown-menu" id="splash-user-menu">
                        <div class="user-email">${currentUser.email}</div>
                        <button class="logout-btn"><i class="fas fa-sign-out-alt"></i> Logout</button>
                    </div>
                </div>`;

            authContainer.querySelector('#splash-user-menu-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('splash-user-menu').classList.toggle('visible');
            });
            authContainer.querySelector('.logout-btn').addEventListener('click', logout);
        } else {
            // This part is redundant as the default HTML is the login button, but good for clarity on re-renders
            authContainer.innerHTML = `<button id="splash-login-btn" class="btn-modern btn-modern-secondary"><i class="fas fa-sign-in-alt"></i> Login</button>`;
            const loginBtn = document.getElementById('splash-login-btn');
            if(loginBtn) loginBtn.addEventListener('click', loginWithGoogle);
        }
    }

    function updateMapView() {
        if (currentGuide) {
            // Rerender text content based on the current language
            renderGuideText(currentGuide.current_lang);
            authorNameSpan.textContent = currentGuide.author?.email || 'Unknown';
            guideMetaContainer.classList.remove('hidden');
            renderPoiList();
            renderPois();
            drawTourRoute();
            renderLanguageSwitcher(); // New function call
        } else {
            sidebarViewTitle.textContent = 'All Guides';
            authorNameSpan.textContent = '';
            guideMetaContainer.classList.add('hidden');
            document.getElementById('guide-language-switcher-container').classList.add('hidden');
            poiList.innerHTML = '';
        }
        updateHeaderControls();
        setMode('view');
    }

    function switchGuideLanguage(newLang) {
        if (!currentGuide || !currentGuide.available_langs.includes(newLang)) {
            console.warn(`Language ${newLang} is not available for this guide.`);
            return;
        }
        currentGuide.current_lang = newLang;

        // Update utterance language for TTS
        const ttsLangMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', zh: 'zh-CN' };
        utterance.lang = ttsLangMap[newLang] || 'en-US';

        // Re-render all text-based UI components
        updateMapView();
    }

    function renderGuideText(langCode) {
        if (!currentGuide) return;

        let guideDetailsObj = currentGuide.details;
        if (typeof guideDetailsObj === 'string') {
            try { guideDetailsObj = JSON.parse(guideDetailsObj); } catch (e) { guideDetailsObj = {}; }
        }
        const guideDetails = guideDetailsObj?.[langCode] || guideDetailsObj?.[currentGuide.default_lang] || {};
        currentGuide.title = guideDetails.title || 'Untitled Guide';
        currentGuide.summary = guideDetails.summary || '';
        sidebarViewTitle.textContent = currentGuide.title;

        // Process POI texts for the selected language
        pois.forEach(poi => {
            let poiTextsObj = poi.texts;
            if (typeof poiTextsObj === 'string') {
                try { poiTextsObj = JSON.parse(poiTextsObj); } catch (e) { poiTextsObj = {}; }
            }
            const poiTexts = poiTextsObj?.[langCode] || poiTextsObj?.[currentGuide.default_lang] || {};
            poi.name = poiTexts.title || 'Untitled POI';
            poi.description = poiTexts.description || '';
        });
    }

    function renderLanguageSwitcher() {
        const container = document.getElementById('guide-language-switcher-container');
        const select = document.getElementById('guide-language-select');
        if (!currentGuide || !currentGuide.available_langs) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        select.innerHTML = '';
        const langMap = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', zh: '中文' };
        const flagEmojiMap = { en: '🇬🇧', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', zh: '🇨🇳' };

        currentGuide.available_langs.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang;
            const emoji = flagEmojiMap[lang] || '🏳️';
            option.textContent = `${emoji} ${langMap[lang] || lang}`;
            if (lang === currentGuide.current_lang) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.onchange = () => switchGuideLanguage(select.value);
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

        const intros = introPhrases[currentGuide?.default_lang || 'en'] || introPhrases.en;
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

    function renderGuideList(searchTerm = '') {
        const guidesToRender = searchTerm
            ? allFetchedGuides.filter(guide => {
                const guideDetails = guide.details?.[selectedLanguage] || guide.details?.[guide.default_lang] || { title: '', summary: '' };
                const title = guideDetails.title || '';
                const summary = guideDetails.summary || '';
                return title.toLowerCase().includes(searchTerm) || summary.toLowerCase().includes(searchTerm);
            })
            : allFetchedGuides;

        if (guidesToRender.length === 0) {
            guideCatalogList.innerHTML = `<p>No guides found.</p>`;
            return;
        }

        guideCatalogList.innerHTML = '';
        guidesToRender.forEach(guide => {
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

            const guideDetails = details_obj?.[selectedLanguage] || details_obj?.[guide.default_lang] || details_obj?.[Object.keys(details_obj || {})[0]] || { title: 'Untitled', summary: '' };
            const title = guideDetails.title;
            const summary = guideDetails.summary;

            card.innerHTML = `<h5 class="card-title">${title}</h5><p class="card-text">${summary || ''}</p>`;
            card.addEventListener('click', () => loadGuide(guide.slug));
            guideCatalogList.appendChild(card);
        });
    }

    async function fetchAndDisplayGuides() {
        if (!selectedLanguage) {
            guideCatalogList.innerHTML = '<p>Select a language from the splash screen to see available guides.</p>';
            return;
        }

        const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';
        let query = supabase.from('guides')
            .select('slug, details, default_lang, available_langs, rating')
            .contains('available_langs', `{${selectedLanguage}}`)
            .order('rating', { ascending: false });

        if (isEditor && currentUser) {
            query = query.or(`author_id.eq.${currentUser.id},status.eq.published`);
        } else {
            query = query.eq('status', 'published');
        }

        const { data: guides, error } = await query;

        if (error) {
            console.error("Error fetching guides:", error);
            guideCatalogList.innerHTML = `<p>Error loading guides.</p>`;
            allFetchedGuides = [];
            return;
        }

        allFetchedGuides = guides || [];
        document.getElementById('guide-search-input').value = ''; // Clear search
        renderGuideList(); // Render the full list
    }

    async function loadGuide(slug) {
        const { data: guideData, error } = await supabase.from('guides').select('*, author:profiles(email)').eq('slug', slug).single();
        if (error || !guideData) {
            alert(`Error loading guide: ${error?.message || 'Guide not found.'}`);
            return;
        }
        const { data: sectionsData, error: sectionsError } = await supabase.from('guide_poi').select('*').eq('guide_id', guideData.id).order('order');
        if (sectionsError) {
            alert(`Error loading guide POIs: ${sectionsError.message}`);
            return;
        }
        currentGuide = guideData;
        pois = sectionsData;
        tourRoute = pois.map(p => p.id);

        // Set the initial language for the guide. Prioritize the user's globally selected language.
        if (selectedLanguage && currentGuide.available_langs.includes(selectedLanguage)) {
            currentGuide.current_lang = selectedLanguage;
        } else {
            currentGuide.current_lang = currentGuide.default_lang;
        }

        // Update utterance language for TTS
        const ttsLangMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', zh: 'zh-CN' };
        utterance.lang = ttsLangMap[currentGuide.current_lang] || 'en-US';

        map.setView([currentGuide.initial_lat, currentGuide.initial_lon], currentGuide.initial_zoom);
        updateMapView();
        switchSidebarView('map');

        if (isMobile()) {
            document.querySelector('.sidebar').classList.remove('active');
        }
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
            sidebarHeaderControls.innerHTML = `
                <button id="generate-guide-btn" class="btn-modern btn-modern-sm btn-modern-primary" title="Generate Guide with AI"><i class="fas fa-magic"></i></button>
                <button id="import-guides-btn" class="btn-modern btn-modern-sm btn-modern-secondary" title="Import Guides"><i class="fas fa-file-import"></i></button>
                <button id="export-all-btn" class="btn-modern btn-modern-sm btn-modern-secondary" title="Export All Guides"><i class="fas fa-file-export"></i></button>
                <button id="create-guide-btn" class="btn-modern btn-modern-sm" title="New Guide"><i class="fas fa-plus"></i> New</button>
            `;
            sidebarHeaderControls.querySelector('#generate-guide-btn').onclick = showGenerateGuideModal;
            sidebarHeaderControls.querySelector('#import-guides-btn').onclick = () => document.getElementById('import-guides-input').click();
            sidebarHeaderControls.querySelector('#export-all-btn').onclick = exportAllGuides;
            sidebarHeaderControls.querySelector('#create-guide-btn').onclick = createNewGuide;
        } else if (currentView === 'map') {
            if (currentGuide) {
                setMode(isEditMode ? 'edit' : 'view'); // Re-render controls for map view
            } else {
                // No guide is loaded, but show the main creation buttons for editors
                sidebarHeaderControls.innerHTML = `
                    <button id="generate-guide-btn" class="btn-modern btn-modern-sm btn-modern-primary" title="Generate Guide with AI"><i class="fas fa-magic"></i></button>
                    <button id="import-guides-btn" class="btn-modern btn-modern-sm btn-modern-secondary" title="Import Guides"><i class="fas fa-file-import"></i></button>
                    <button id="create-guide-btn" class="btn-modern btn-modern-sm" title="New Guide"><i class="fas fa-plus"></i> New</button>
                `;
                sidebarHeaderControls.querySelector('#generate-guide-btn').onclick = showGenerateGuideModal;
                sidebarHeaderControls.querySelector('#import-guides-btn').onclick = () => document.getElementById('import-guides-input').click();
                sidebarHeaderControls.querySelector('#create-guide-btn').onclick = createNewGuide;
            }
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
                <button id="translate-guide-btn" class="btn-modern btn-modern-sm btn-modern-secondary" title="Duplicate & Translate"><i class="fas fa-language"></i></button>
            `;
            sidebarHeaderControls.querySelector('#save-guide-btn').onclick = saveGuide;
            sidebarHeaderControls.querySelector('#export-guide-btn').onclick = exportForTranslation;
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
        const intros = introPhrases[currentGuide?.default_lang || 'en'] || introPhrases.en;
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
            if (!guideData) {
                alert("Failed to create guide. This may be due to a permissions issue. Please ensure you have the 'editor' role.");
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
            const { error: deleteError } = await supabase.from('guide_poi').delete().in('id', poisToDelete);
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

        // 2. Upsert (insert or update) the remaining POIs
        if (sectionsToSave.length > 0) {
            const { data: upsertData, error: upsertError } = await supabase.from('guide_poi').upsert(sectionsToSave).select();
            if (upsertError) {
                alert(`Error saving POIs: ${upsertError.message}`);
                return;
            }
            if (!upsertData || upsertData.length === 0) {
                alert("Failed to save POIs. This may be due to a permissions issue. Please ensure you have the 'editor' role.");
                return;
            }
        }

        alert('Guide saved successfully!');
        await loadGuide(currentGuide.slug); // Reload to get fresh data
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
                <div class="form-group">
                    <label for="status">Status</label>
                    <select name="status" class="form-select">
                        <option value="draft" ${currentGuide.status === 'draft' ? 'selected' : ''}>Draft</option>
                        <option value="published" ${currentGuide.status === 'published' ? 'selected' : ''}>Published</option>
                    </select>
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

            const { data: responseData, error } = await supabase.from('guides')
                .update({ details: newDetails, status: data.status })
                .eq('id', currentGuide.id)
                .select();

            if (error) {
                alert(`Error updating guide: ${error.message}`);
                return false;
            }
            if (!responseData || responseData.length === 0) {
                alert("Failed to save changes. This may be due to a permissions issue. Please ensure you have the 'editor' role.");
                return false;
            }

            alert('Guide details saved!');
            await loadGuide(currentGuide.slug); // Reload to see changes
            return true;
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

    async function importGuides(json) {
        let parsedData;
        try {
            // Clean the JSON string to remove common errors like trailing commas
            const cleanedJson = json.replace(/,\s*([\]}])/g, '$1');
            parsedData = JSON.parse(cleanedJson);
            if (!parsedData.guides || !Array.isArray(parsedData.guides)) {
                throw new Error("Invalid JSON format: 'guides' array not found.");
            }
        } catch (error) {
            alert(`Error reading file: ${error.message}`);
            return;
        }

        showFormModal('Importing...', '<div class="loader"></div>', () => {});

        try {
            for (const guide of parsedData.guides) {
                const { pois, ...aiGuideData } = guide;

                // Sanitize and construct the guide object to ensure all required fields are present
                const cleanGuideData = {
                    slug: aiGuideData.slug,
                    details: aiGuideData.details,
                    status: aiGuideData.status || 'draft',
                    default_lang: aiGuideData.default_lang || 'en',
                    available_langs: aiGuideData.available_langs || ['en'],
                    author_id: currentUser.id, // Always set the importer as the author
                    cover_url: aiGuideData.cover_url,
                    initial_lat: aiGuideData.initial_lat,
                    initial_lon: aiGuideData.initial_lon,
                    initial_zoom: aiGuideData.initial_zoom
                };

                // 1. Upsert the guide itself, using slug as the conflict target
                const { data: upsertedGuide, error: guideError } = await supabase
                    .from('guides')
                    .upsert(cleanGuideData, { onConflict: 'slug' })
                    .select('id')
                    .single();

                if (guideError || !upsertedGuide) throw new Error(`Failed to import guide "${guideData.slug}": ${guideError?.message}`);

                const guideId = upsertedGuide.id;

                // 2. Clear all old POIs for this guide to ensure a clean import
                const { error: deleteError } = await supabase.from('guide_poi').delete().eq('guide_id', guideId);
                if (deleteError) throw new Error(`Failed to clear old POIs for guide "${guideData.slug}": ${deleteError.message}`);

                // 3. Insert the new POIs
                if (pois && pois.length > 0) {
                    const newPois = pois.map(p => {
                        delete p.id; // Let DB handle the ID
                        p.guide_id = guideId; // Assign the correct new guide ID
                        return p;
                    });
                    const { error: poiError } = await supabase.from('guide_poi').insert(newPois);
                    if (poiError) throw new Error(`Failed to import POIs for guide "${guideData.slug}": ${poiError.message}`);
                }
            }

            hideFormModal();
            alert('Import complete! Reloading to see changes.');
            window.location.reload();

        } catch (error) {
            hideFormModal();
            alert(`An error occurred during import: ${error.message}`);
        }
    }

    async function exportAllGuides() {
        showFormModal('Exporting...', '<div class="loader"></div>', () => {});
        try {
            const { data: guides, error: guidesError } = await supabase.from('guides').select('*');
            if (guidesError) throw guidesError;

            const { data: pois, error: poisError } = await supabase.from('guide_poi').select('*');
            if (poisError) throw poisError;

            const poisByGuideId = {};
            pois.forEach(p => {
                if (!poisByGuideId[p.guide_id]) {
                    poisByGuideId[p.guide_id] = [];
                }
                poisByGuideId[p.guide_id].push(p);
            });

            const exportData = guides.map(g => ({
                ...g,
                pois: poisByGuideId[g.id] || []
            }));

            downloadJson({ guides: exportData }, 'waywhispery-backup.json');
            hideFormModal();
        } catch (error) {
            hideFormModal();
            alert(`Failed to export guides: ${error.message}`);
        }
    }

    function showGenerateGuideModal() {
        const formHTML = `
            <form>
                <div class="form-group">
                    <label for="topic">What topic would you like to generate a guide for?</label>
                    <input type="text" name="topic" placeholder="e.g., A walking tour of the Roman Forum" required maxlength="50">
                </div>
                <p class="text-muted small">The AI will generate a title, summary, and a list of 10-15 POIs with coordinates. This may take a moment.</p>
                <button type="submit" class="btn-modern">Generate Guide</button>
            </form>
        `;
        showFormModal('Generate Guide with AI', formHTML, (data) => {
            runGuideGeneration(data.topic);
            // By not returning true, we prevent the modal from closing.
            // runGuideGeneration will replace its content with the loader.
        });
    }

    async function runGuideGeneration(topic) {
        showFormModal('Generating Guide...', '<div class="loader"></div>', () => {});

        const prompt = `
            You are an expert tour guide creator. Your task is to generate a complete tour guide on a given topic, translated into multiple languages.
            The output must be a single, valid JSON object and nothing else. Do not include any text, explanation, or markdown fences before or after the JSON object.

            The topic is: "${topic}".

            The JSON object must follow this exact structure. You MUST provide translations for all 5 languages: en, es, fr, de, zh.

            {
              "guides": [
                {
                  "slug": "a-unique-slug-for-the-guide-in-english",
                  "default_lang": "en",
                  "available_langs": ["en", "es", "fr", "de", "zh"],
                  "status": "draft",
                  "details": {
                    "en": { "title": "Guide Title in English", "summary": "A brief summary of the guide, in English." },
                    "es": { "title": "Título de la Guía en Español", "summary": "Un breve resumen de la guía, en español." },
                    "fr": { "title": "Titre du Guide en Français", "summary": "Un bref résumé du guide, en français." },
                    "de": { "title": "Titel des Leitfadens auf Deutsch", "summary": "Eine kurze Zusammenfassung des Leitfadens, auf Deutsch." },
                    "zh": { "title": "中文指南标题", "summary": "中文指南的简要概述。" }
                  },
                  "pois": [
                    {
                      "order": 1,
                      "texts": {
                        "en": { "title": "POI 1 Title", "description": "POI 1 Description." },
                        "es": { "title": "Título del PDI 1", "description": "Descripción del PDI 1." },
                        "fr": { "title": "Titre du POI 1", "description": "Description du POI 1." },
                        "de": { "title": "Titel von POI 1", "description": "Beschreibung von POI 1." },
                        "zh": { "title": "POI 1的标题", "description": "POI 1的描述。" }
                      },
                      "lat": 41.8925,
                      "lon": 12.4853
                    }
                  ]
                }
              ]
            }

            Please generate a guide with 10 to 15 POIs. The POIs should be in a logical walking order.
            You MUST invent plausible latitude and longitude coordinates for each POI, centered around the main topic location.
            The slug should be a URL-friendly version of the English title.
        `;

        try {
            const payload = {
                model: 'openai',
                messages: [{ role: 'user', content: prompt }]
            };

            const response = await fetch('https://text.pollinations.ai/openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const result = await response.json();
            let jsonResponse = result.choices[0].message.content;

            // Clean the response to ensure it's just a JSON object
            const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("AI did not return a valid JSON object.");
            }
            jsonResponse = jsonMatch[0];

            // Show the generated JSON in a preview modal
            hideFormModal(); // Hide the "generating" loader
            showJsonPreviewModal(jsonResponse);

        } catch (error) {
            hideFormModal();
            alert(`AI guide generation failed: ${error.message}`);
            console.error(error);
        }
    }

    function showJsonPreviewModal(jsonString) {
        let prettyJson;
        try {
            // Try to format the JSON for better readability.
            prettyJson = JSON.stringify(JSON.parse(jsonString), null, 2);
        } catch (e) {
            // If it's invalid, show the raw string.
            prettyJson = jsonString;
        }

        const previewHTML = `
            <p>The AI-generated JSON is below. It may have errors. You can edit it here before importing.</p>
            <details>
                <summary>Show/Hide Generated JSON</summary>
                <textarea id="json-editor-textarea" class="json-preview">${prettyJson}</textarea>
            </details>
            <div id="json-validation-status" class="validation-status"></div>
            <div class="form-actions">
                <button id="validate-json-btn" class="btn-modern btn-modern-secondary">Validate JSON</button>
                <button id="import-from-preview-btn" class="btn-modern btn-modern-primary">Import Guide</button>
                <button id="export-from-preview-btn" class="btn-modern btn-modern-secondary">Export JSON</button>
            </div>
        `;

        showFormModal('AI Generation Result', previewHTML, () => {});

        // Manually add event listeners for our custom buttons
        document.getElementById('validate-json-btn').addEventListener('click', () => {
            const editedJson = document.getElementById('json-editor-textarea').value;
            const statusDiv = document.getElementById('json-validation-status');
            try {
                JSON.parse(editedJson);
                statusDiv.textContent = 'JSON is valid!';
                statusDiv.style.color = 'green';
            } catch (error) {
                statusDiv.textContent = `Invalid JSON: ${error.message}`;
                statusDiv.style.color = 'red';
            }
        });
        document.getElementById('import-from-preview-btn').addEventListener('click', () => {
            const editedJson = document.getElementById('json-editor-textarea').value;
            importGuides(editedJson);
        });
        document.getElementById('export-from-preview-btn').addEventListener('click', () => {
            const editedJson = document.getElementById('json-editor-textarea').value;
            try {
                downloadJson(JSON.parse(editedJson), 'ai-generated-guide.json');
            } catch (error) {
                alert(`Cannot export invalid JSON. Please fix the errors first.\nError: ${error.message}`);
            }
        });
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

            // Instead of applying, prompt for duplication details
            hideFormModal();
            promptForDuplicationDetails(translatedData, targetLang);

        } catch (error) {
            hideFormModal();
            alert(`Translation failed: ${error.message}`);
        }
    }

    function promptForDuplicationDetails(translatedData, targetLang) {
        const suggestedSlug = `${currentGuide.slug}-${targetLang}`;
        const formHTML = `
            <p>Please confirm the details for the new, duplicated guide in <strong>${targetLang.toUpperCase()}</strong>.</p>
            <form>
                <div class="form-group">
                    <label for="title">New Guide Title</label>
                    <input type="text" name="title" value="${translatedData.guide.title}" required>
                </div>
                <div class="form-group">
                    <label for="slug">New Guide Slug (URL)</label>
                    <input type="text" name="slug" value="${suggestedSlug}" required pattern="[a-z0-9-]+">
                </div>
                <button type="submit" class="btn-modern">Create Duplicated Guide</button>
            </form>
        `;

        showFormModal('Confirm New Guide Details', formHTML, (data) => {
            createDuplicateGuide(data, translatedData, targetLang);
            return true;
        });
    }

    async function createDuplicateGuide(details, translatedData, targetLang) {
        showFormModal('Duplicating Guide...', '<div class="loader"></div>', () => {});

        try {
            // 1. Create the new guide entry
            const newGuideObject = {
                slug: details.slug,
                details: {
                    [targetLang]: {
                        title: details.title,
                        summary: translatedData.guide.summary
                    }
                },
                default_lang: targetLang,
                available_langs: [targetLang],
                status: 'draft', // New duplicated guides are drafts by default
                author_id: currentUser.id,
                initial_lat: currentGuide.initial_lat,
                initial_lon: currentGuide.initial_lon,
                initial_zoom: currentGuide.initial_zoom,
                cover_url: currentGuide.cover_url
            };

            const { data: newGuideData, error: guideError } = await supabase
                .from('guides')
                .insert(newGuideObject)
                .select('id')
                .single();

            if (guideError || !newGuideData) {
                throw new Error(`Failed to create new guide: ${guideError?.message || 'No data returned.'}`);
            }

            const newGuideId = newGuideData.id;

            // 2. Prepare the new POIs (guide_sections)
            const newSections = pois.map((originalPoi, index) => {
                return {
                    guide_id: newGuideId,
                    order: originalPoi.order,
                    lat: originalPoi.lat,
                    lon: originalPoi.lon,
                    texts: {
                        [targetLang]: {
                            title: translatedData.pois[originalPoi.id]?.title || '',
                            description: translatedData.pois[originalPoi.id]?.description || ''
                        }
                    }
                };
            });

            // 3. Bulk insert the new POIs
            const { error: sectionsError } = await supabase.from('guide_poi').insert(newSections);

            if (sectionsError) {
                // Note: This could leave an orphaned guide. A more robust solution might use a transaction or delete the guide.
                throw new Error(`Failed to create POIs for the new guide: ${sectionsError.message}`);
            }

            hideFormModal();
            alert(`Successfully created new guide: "${details.title}". It is saved as a draft.`);
            window.location.reload(); // Reload to see the new guide in the list

        } catch (error) {
            hideFormModal();
            alert(`An error occurred during duplication: ${error.message}`);
        }
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
    // Tutorial Logic
    // -----------------------------------------------------------------------------
    function checkAndStartTutorial() {
        if (userProfile?.role === 'editor' && !localStorage.getItem('waywhispery_tutorial_seen')) {
            startEditorTutorial();
        }
    }

    function startEditorTutorial() {
        const steps = [
            {
                element: '#logo-btn',
                title: 'Welcome, Editor!',
                text: 'This is the main guide list. Click here to see all available guides.'
            },
            {
                element: '#generate-guide-btn',
                title: 'Create with AI',
                text: 'Click this magic button to generate a complete, multilingual walking tour about any topic!'
            },
            {
                element: '#create-guide-btn',
                title: 'Create Manually',
                text: 'You can also create a new guide from scratch and add points of interest yourself.'
            }
        ];

        let currentStep = 0;
        let overlay, tooltip;

        function showStep(stepIndex) {
            const step = steps[stepIndex];
            const targetElement = document.querySelector(step.element);
            if (!targetElement) {
                console.warn('Tutorial element not found:', step.element);
                cleanup();
                return;
            }

            // Ensure the view is correct
            if (step.element === '#logo-btn' || step.element === '#generate-guide-btn' || step.element === '#create-guide-btn') {
                switchSidebarView('guides');
            }

            // Create tooltip
            tooltip = document.createElement('div');
            tooltip.className = 'tooltip-box';
            tooltip.innerHTML = `
                <h4>${step.title}</h4>
                <p>${step.text}</p>
                <div class="tooltip-actions">
                    <button class="btn-modern btn-modern-secondary" id="skip-tutorial">Skip</button>
                    <button class="btn-modern" id="next-tutorial">${stepIndex === steps.length - 1 ? 'Finish' : 'Next'}</button>
                </div>
                <div class="tooltip-arrow down"></div>
            `;
            document.body.appendChild(tooltip);

            // Position tooltip
            const targetRect = targetElement.getBoundingClientRect();
            tooltip.style.top = `${targetRect.bottom + 10}px`;
            tooltip.style.left = `${targetRect.left}px`;

            // Event listeners
            tooltip.querySelector('#skip-tutorial').onclick = cleanup;
            tooltip.querySelector('#next-tutorial').onclick = () => {
                currentStep++;
                if (currentStep >= steps.length) {
                    cleanup();
                } else {
                    tooltip.remove();
                    showStep(currentStep);
                }
            };
        }

        function cleanup() {
            if (overlay) overlay.remove();
            if (tooltip) tooltip.remove();
            localStorage.setItem('waywhispery_tutorial_seen', 'true');
        }

        // Start the tutorial
        overlay = document.createElement('div');
        overlay.className = 'tooltip-overlay';
        document.body.appendChild(overlay);
        showStep(currentStep);
    }

    // -----------------------------------------------------------------------------
    // Initializer
    // -----------------------------------------------------------------------------
    async function init() {
        const splashScreen = document.getElementById('splash-screen');
        const splashLoader = document.getElementById('splash-loader');
        const languageFlags = document.querySelectorAll('.flag-icon');
        const splashLoginBtn = document.getElementById('splash-login-btn');

        function updateLangButton(lang) {
            const flagCodeMap = { en: 'gb', zh: 'cn' };
            const flagCode = flagCodeMap[lang] || lang;
            langBtn.innerHTML = `<img src="https://flagcdn.com/w20/${flagCode}.png" alt="${lang}">`;
        }

        function populateLangMenu() {
            const langMenu = document.getElementById('lang-menu');
            const langMap = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', zh: '中文' };
            const flagCodeMap = { en: 'gb', zh: 'cn' }; // Map for special flag codes
            langMenu.innerHTML = ''; // Clear previous options
            for (const [code, name] of Object.entries(langMap)) {
                const flagCode = flagCodeMap[code] || code;
                const langItem = document.createElement('button');
                langItem.className = 'logout-btn'; // Re-use style
                langItem.innerHTML = `<img src="https://flagcdn.com/w20/${flagCode}.png" alt="${name}" style="margin-right: 10px;"> ${name}`;
                langItem.addEventListener('click', () => {
                    // This is now a global language switcher
                    selectedLanguage = code;
                    updateLangButton(code);
                    langMenu.classList.remove('visible');

                    // 1. Refresh the guide list with the new language
                    fetchAndDisplayGuides();

                    // 2. If a guide is currently open, try to switch its language
                    if (currentGuide && currentGuide.available_langs.includes(code)) {
                        switchGuideLanguage(code);
                    }

                    // 3. Ensure the guides view is active if we are not in a guide context
                    if (!currentGuide) {
                        switchSidebarView('guides');
                    }
                });
                langMenu.appendChild(langItem);
            }
        }

        const startApp = async (lang) => {
            selectedLanguage = lang;
            updateLangButton(lang);
            splashLoader.classList.remove('hidden');

            try {
                // This logic now only runs once on the first app start
                if(!map) {
                    initializeMap();
                    setupEventListeners();
                    populateLangMenu();

                    // Set up auth listeners once
                    supabase.auth.onAuthStateChange(async (event, session) => {
                        currentUser = session?.user || null;
                        userProfile = currentUser ? await getProfile(currentUser.id) : null;
                        updateUIforAuth();
                        updateHeaderControls(); // Also update header controls on auth change
                        checkAndStartTutorial(); // Check if we need to show the tutorial
                    });

                    // Get initial session
                    const { data: { session } } = await supabase.auth.getSession();
                    currentUser = session?.user || null;
                    userProfile = currentUser ? await getProfile(currentUser.id) : null;
                    updateUIforAuth();
                    updateSplashAuthUI();
                }

                // Fetch content for the first time
                await fetchAndDisplayGuides();
                updateMapView(); // Initial map view setup

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

