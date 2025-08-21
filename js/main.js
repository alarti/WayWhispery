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
    // Local Database (IndexedDB with Dexie.js)
    // -----------------------------------------------------------------------------
    const db = new Dexie('waywhispery_db');
    db.version(3).stores({
        guides: 'id, slug, *available_langs', // Primary key 'id', index on 'slug' and 'available_langs'
        guide_poi: 'id, guide_id', // Primary key 'id', index on 'guide_id'
        mutations: '++id, error_count' // Auto-incrementing PK, index on error_count for querying failed mutations
    });

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

    const uiStrings = {
        allGuides: { en: 'All Guides', es: 'Todas las Guías', fr: 'Tous les Guides', de: 'Alle Anleitungen', zh: '所有指南' },
        guideDetails: { en: 'Guide Details', es: 'Detalles de la Guía', fr: 'Détails du Guide', de: 'Anleitungsdetails', zh: '指南详情' },
        liveGpsMode: { en: 'Live GPS Mode', es: 'Modo GPS en Vivo', fr: 'Mode GPS en Direct', de: 'Live-GPS-Modus', zh: '实时GPS模式' },
        pois: { en: 'Points of Interest', es: 'Puntos de Interés', fr: 'Points d\'Intérêt', de: 'Sehenswürdigkeiten', zh: '兴趣点' }
    };

    function translateUI(lang) {
        // Ensure lang is valid, fallback to English
        const l = uiStrings.allGuides[lang] ? lang : 'en';

        // Sidebar title when no guide is selected
        if (!currentGuide) {
            sidebarViewTitle.textContent = uiStrings.allGuides[l];
        }

        // Other static elements
        const liveModeLabel = document.querySelector('label[for="live-mode-toggle"]');
        if (liveModeLabel) liveModeLabel.textContent = uiStrings.liveGpsMode[l];

        const poiListHeader = sidebarMapView.querySelector('h5');
        if (poiListHeader) poiListHeader.textContent = uiStrings.pois[l];
    }

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

        // Activity Bar Editor Actions
        document.getElementById('ac-generate-guide-btn').onclick = showGenerateGuideModal;
        document.getElementById('ac-create-guide-btn').onclick = createNewGuide;
        document.getElementById('ac-import-guides-btn').onclick = () => document.getElementById('import-guides-input').click();
        document.getElementById('ac-export-all-btn').onclick = exportAllGuides;

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
        updateActionButtonsVisibility();
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

            const intros = introPhrases[currentGuide?.current_lang || 'en'] || introPhrases.en;
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

    function renderStars(ratingSum, ratingCount, guideId) {
        const averageRating = ratingCount > 0 ? ratingSum / ratingCount : 0;
        const fullStars = Math.round(averageRating);
        let starsHTML = '';

        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                starsHTML += `<i class="fas fa-star"></i>`;
            } else {
                starsHTML += `<i class="far fa-star"></i>`;
            }
        }

        return `<div class="stars">${starsHTML}</div> <span class="rating-count">(${ratingCount})</span>`;
    }

    async function handleRating(guideId, ratingValue) {
        const ratedGuides = JSON.parse(localStorage.getItem('rated_guides') || '[]');
        if (ratedGuides.includes(guideId)) {
            alert('You have already rated this guide.');
            return;
        }

        if (navigator.onLine) {
            // Online: Call RPC directly
            const { error } = await supabase.rpc('rate_guide', {
                guide_id_to_rate: guideId,
                rating_value: ratingValue
            });

            if (error) {
                alert(`Error submitting rating: ${error.message}`);
                return; // Don't proceed if there was an error
            } else {
                alert('Thank you for your rating!');
            }
        } else {
            // Offline: Add to mutations outbox
            await db.mutations.add({
                type: 'rate_guide',
                payload: { guideId, ratingValue },
                createdAt: new Date()
            });
            alert('You are offline. Your rating has been saved and will be submitted when you reconnect.');
        }

        // In both cases, mark as rated locally to prevent re-rating
        ratedGuides.push(guideId);
        localStorage.setItem('rated_guides', JSON.stringify(ratedGuides));

        // Visually disable rating for this guide
        const starContainer = document.querySelector(`.card[data-guide-id="${guideId}"] .interactive-stars`);
        if (starContainer) {
            starContainer.parentElement.innerHTML = 'Thanks for rating!';
        }
    }

    async function renderGuideList(searchTerm = '') {
        const guidesToRender = searchTerm
            ? allFetchedGuides.filter(guide => {
                const guideDetails = guide.details?.[selectedLanguage] || guide.details?.[guide.default_lang] || { title: '', summary: '' };
                const title = guideDetails.title || '';
                const summary = guideDetails.summary || '';
                return title.toLowerCase().includes(searchTerm) || summary.toLowerCase().includes(searchTerm);
            })
            : allFetchedGuides;

        if (guidesToRender.length === 0) {
            guideCatalogList.innerHTML = `<p class="text-muted p-3">No guides found for the selected language. <br><br>Try selecting another language, or create a new guide if you are an editor.</p>`;
            return;
        }

        // Get all guide IDs that have pending mutations
        const pendingMutations = await db.mutations.toArray();
        const pendingGuideIds = new Set();
        for (const mut of pendingMutations) {
            if (mut.type === 'guide_create' || mut.type === 'guide_delete') {
                pendingGuideIds.add(mut.payload.id);
            } else if (mut.type === 'poi_upsert' || mut.type === 'poi_delete') {
                pendingGuideIds.add(mut.payload.guide_id);
            }
        }

        const ratedGuides = JSON.parse(localStorage.getItem('rated_guides') || '[]');
        guideCatalogList.innerHTML = '';
        guidesToRender.forEach(guide => {
            const card = document.createElement('div');
            card.className = 'card';
            if (pendingGuideIds.has(guide.id)) {
                card.classList.add('pending-sync');
            }
            card.dataset.guideId = guide.id; // Set guide ID for rating logic

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

            let ratingHTML = `<div class="star-rating">${renderStars(guide.rating, guide.rating_count, guide.id)}</div>`;
            if (!ratedGuides.includes(guide.id)) {
                let interactiveStarsHTML = '';
                for (let i = 1; i <= 5; i++) {
                    interactiveStarsHTML += `<i class="far fa-star" data-value="${i}"></i>`;
                }
                ratingHTML += `<div class="interactive-stars" title="Rate this guide">${interactiveStarsHTML}</div>`;
            }

            card.innerHTML = `<h5 class="card-title">${title}</h5><p class="card-text">${summary || ''}</p>${ratingHTML}`;

            card.querySelector('.card-title').addEventListener('click', () => loadGuide(guide.slug));
            card.querySelector('.card-text').addEventListener('click', () => loadGuide(guide.slug));

            const interactiveStarsContainer = card.querySelector('.interactive-stars');
            if (interactiveStarsContainer) {
                interactiveStarsContainer.querySelectorAll('i').forEach(star => { // Select all icons
                    star.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const ratingValue = parseInt(e.target.dataset.value, 10);
                        handleRating(guide.id, ratingValue);
                    });
                });
            }
        });
    }

    async function fetchAndDisplayGuides() {
        if (!selectedLanguage) {
            guideCatalogList.innerHTML = '<p>Select a language from the splash screen to see available guides.</p>';
            return;
        }
        console.log(`Fetching local guides. Language: '${selectedLanguage}'`);

        try {
            // Now reading from local Dexie DB
            // Fetch all guides; filtering is handled by the rendering logic's language fallback.
            const guides = await db.guides.toArray();

            // Note: The editor-specific view of drafts is lost in this simple offline model.
            // That would be part of a more complex sync strategy in Phase 2.
            // For now, we only show what's been synced (published guides).

            console.log(`Found ${guides.length} guides locally.`);

            allFetchedGuides = guides.sort((a, b) => (b.rating / b.rating_count || 0) - (a.rating / a.rating_count || 0));
            document.getElementById('guide-search-input').value = '';
            renderGuideList();
        } catch (error) {
            console.error("Error fetching guides from local DB:", error);
            guideCatalogList.innerHTML = `<p>Error loading guides.</p>`;
            allFetchedGuides = [];
        }
    }

    async function loadGuide(slug) {
        try {
            // Fetch guide and its POIs from the local Dexie DB
            const guideData = await db.guides.get({ slug: slug });
            if (!guideData) {
                alert('Guide not found in local database. It might not be published or the app is not synced.');
                return;
            }

            const sectionsData = await db.guide_poi
                .where('guide_id')
                .equals(guideData.id)
                .sortBy('order');

            currentGuide = guideData;
            // The author email is not synced, so we can't display it in offline mode.
            // A more complex sync would involve a `profiles` table.
            currentGuide.author = { email: 'Unavailable offline' };
            pois = sectionsData;
            tourRoute = pois.map(p => p.id);
        } catch (error) {
            console.error("Error loading guide from local DB:", error);
            alert(`Error loading guide: ${error.message}`);
            return;
        }

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
    function updateActionButtonsVisibility() {
        const container = document.getElementById('editor-actions-activity-bar');
        const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';

        if (isEditor) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }

    function updateHeaderControls() {
        sidebarHeaderControls.innerHTML = '';
        const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';
        if (!isEditor) return;

        // This function now ONLY handles controls for an ACTIVE guide.
        if (currentGuide) {
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
        const intros = introPhrases[currentGuide?.current_lang || 'en'] || introPhrases.en;
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

            const tempId = crypto.randomUUID();
            const newGuideData = {
                id: tempId, // Use temp UUID for local storage
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
                },
                rating: 0,
                rating_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            if (navigator.onLine) {
                // Online: Insert into Supabase, then update local
                const { data: guideData, error } = await supabase.from('guides').insert(newGuideData).select().single();
                if (error) {
                    alert(`Error creating guide: ${error.message}`);
                    return false;
                }
                await db.guides.put(guideData); // Use put to add/update local
                await loadGuide(guideData.slug);
            } else {
                // Offline: Insert into local DB and queue mutation
                await db.guides.add(newGuideData);
                await db.mutations.add({
                    type: 'guide_create',
                    payload: newGuideData,
                    createdAt: new Date()
                });
                alert('You are offline. Guide created locally and will be synced when you reconnect.');
                await loadGuide(newGuideData.slug);
            }

            setMode('edit');
            return true;
        });
    }

    async function saveGuide() {
        if (navigator.onLine) {
            // ONLINE: Perform operations on Supabase first, then sync to local
            try {
                if (poisToDelete.length > 0) {
                    await supabase.from('guide_poi').delete().in('id', poisToDelete);
                }
                const sectionsToSave = pois.map((poi, index) => ({
                    id: poi.id.startsWith('temp-') ? crypto.randomUUID() : poi.id,
                    guide_id: currentGuide.id,
                    texts: poi.texts,
                    lat: poi.lat,
                    lon: poi.lon,
                    order: index
                }));
                if (sectionsToSave.length > 0) {
                    await supabase.from('guide_poi').upsert(sectionsToSave);
                }

                // Now sync local DB
                if (poisToDelete.length > 0) {
                    await db.guide_poi.bulkDelete(poisToDelete);
                }
                await db.guide_poi.bulkPut(sectionsToSave);

                poisToDelete = [];
                alert('Guide saved successfully!');

            } catch (error) {
                alert(`Error saving guide online: ${error.message}`);
                return;
            }

        } else {
            // OFFLINE: Perform operations on local DB and queue mutations
            try {
                const mutations = [];
                // Queue deletions
                poisToDelete.forEach(id => {
                    mutations.push({ type: 'poi_delete', payload: { id: id, guide_id: currentGuide.id }, createdAt: new Date() });
                });
                // Queue upserts
                const sectionsToSave = pois.map((poi, index) => ({
                    id: poi.id.startsWith('temp-') ? crypto.randomUUID() : poi.id,
                    guide_id: currentGuide.id,
                    texts: poi.texts,
                    lat: poi.lat,
                    lon: poi.lon,
                    order: index
                }));
                sectionsToSave.forEach(poi => {
                    mutations.push({ type: 'poi_upsert', payload: poi, createdAt: new Date() });
                });

                // Apply changes locally and add mutations to outbox
                await db.transaction('rw', db.guide_poi, db.mutations, async () => {
                    if (poisToDelete.length > 0) await db.guide_poi.bulkDelete(poisToDelete);
                    if (sectionsToSave.length > 0) await db.guide_poi.bulkPut(sectionsToSave);
                    if (mutations.length > 0) await db.mutations.bulkAdd(mutations);
                });

                poisToDelete = [];
                alert('You are offline. Guide changes saved locally and will be synced when you reconnect.');

            } catch (error) {
                alert(`Error saving guide offline: ${error.message}`);
                return;
            }
        }
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
        if (!confirm(`Are you absolutely sure you want todelete the guide "${currentGuide.title}"? This action cannot be undone.`)) return;

        const guideId = currentGuide.id;

        if (navigator.onLine) {
            const { error } = await supabase.from('guides').delete().eq('id', guideId);
            if (error) {
                alert(`Error deleting guide: ${error.message}`);
                return;
            }
        } else {
            await db.mutations.add({
                type: 'guide_delete',
                payload: { id: guideId },
                createdAt: new Date()
            });
        }

        // Delete locally in both cases
        await db.guides.delete(guideId);
        await db.guide_poi.where('guide_id').equals(guideId).delete();

        alert('Guide deleted. It will be removed permanently on next sync if you are offline.');
        window.location.reload();
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
                  "initial_lat": 41.8925,
                  "initial_lon": 12.4853,
                  "initial_zoom": 15,
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
                        "en": { "title": "POI 1 Title", "description": "A very detailed description of the POI. Include interesting facts, historical context, and curiosities about the place.\\n\\nEstimated visit time: 15 minutes." },
                        "es": { "title": "Título del PDI 1", "description": "Una descripción muy detallada del PDI. Incluye datos interesantes, contexto histórico y curiosidades sobre el lugar.\\n\\nTiempo estimado de visita: 15 minutos." },
                        "fr": { "title": "Titre du POI 1", "description": "Une description très détaillée du POI. Incluez des faits intéressants, le contexte historique et des curiosités sur le lieu.\\n\\nTemps de visite estimé : 15 minutes." },
                        "de": { "title": "Titel von POI 1", "description": "Eine sehr detaillierte Beschreibung des POI. Fügen Sie interessante Fakten, historischen Kontext und Kuriositäten über den Ort hinzu.\\n\\nGeschätzte Besuchszeit: 15 Minuten." },
                        "zh": { "title": "POI 1的标题", "description": "关于POI的非常详细的描述。包括有关该地的有趣事实、历史背景和奇闻轶事。\\n\\n预计参观时间：15分钟。" }
                      },
                      "lat": 41.8925,
                      "lon": 12.4853
                    }
                  ]
                }
              ]
            }

            IMPORTANT INSTRUCTIONS:
            1. Generate a guide with 10 to 15 POIs in a logical walking order.
            2. For EACH POI, the 'description' MUST be very detailed and engaging. Include historical facts, curiosities, and an 'Estimated visit time' on a new line.
            3. You MUST invent plausible latitude and longitude coordinates for each POI.
            4. The 'initial_lat' and 'initial_lon' for the guide should be the coordinates of the first POI. 'initial_zoom' should be a sensible value like 15 or 16.
            5. The 'slug' must be a URL-friendly version of the English title.
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
        console.log("Checking if tutorial should start...");
        const tutorialToggle = document.getElementById('tutorial-toggle');

        console.log("User role:", userProfile?.role);
        console.log("Tutorial toggle element found:", !!tutorialToggle);

        if (tutorialToggle) {
            console.log("Tutorial toggle is checked:", tutorialToggle.checked);
        }

        if (userProfile?.role === 'editor' && tutorialToggle?.checked) {
            console.log("Conditions met. Starting tutorial...");
            startEditorTutorial();
        } else {
            console.log("Tutorial conditions not met. Skipping tutorial.");
        }
    }

    const tutorialStrings = {
        // Step Titles
        welcome: { en: 'Welcome, Editor!', es: '¡Bienvenido, Editor!', fr: 'Bienvenue, Éditeur !', de: 'Willkommen, Editor!', zh: '欢迎，编辑！' },
        mapView: { en: 'Map View', es: 'Vista de Mapa', fr: 'Vue Carte', de: 'Kartenansicht', zh: '地图视图' },
        createAI: { en: 'Create with AI', es: 'Crear con IA', fr: 'Créer avec l\'IA', de: 'Mit KI erstellen', zh: '使用AI创建' },
        createManual: { en: 'Create Manually', es: 'Crear Manualmente', fr: 'Créer Manuellement', de: 'Manuell erstellen', zh: '手动创建' },
        importer: { en: 'Import/Export', es: 'Importar/Exportar', fr: 'Importer/Exporter', de: 'Import/Export', zh: '导入/导出' },
        language: { en: 'Language', es: 'Idioma', fr: 'Langue', de: 'Sprache', zh: '语言' },
        session: { en: 'Session', es: 'Sesión', fr: 'Session', de: 'Sitzung', zh: '会话' },
        // Step Descriptions
        guidesListDesc: { en: 'This is the main guide list. Click here to see all available guides.', es: 'Esta es la lista principal de guías. Haz clic aquí para ver todas las guías disponibles.', fr: 'Ceci est la liste principale des guides. Cliquez ici pour voir tous les guides disponibles.', de: 'Dies ist die Hauptliste der Anleitungen. Klicken Sie hier, um alle verfügbaren Anleitungen zu sehen.', zh: '这是主指南列表。点击此处查看所有可用的指南。' },
        mapViewDesc: { en: 'Switch to the map view to see guides geographically and access editor tools.', es: 'Cambia a la vista de mapa para ver las guías geográficamente y acceder a las herramientas de edición.', fr: 'Passez à la vue carte pour voir les guides géographiquement et accéder aux outils d\'édition.', de: 'Wechseln Sie zur Kartenansicht, um die Anleitungen geographisch zu sehen und auf die Editor-Werkzeuge zuzugreifen.', zh: '切换到地图视图以地理方式查看指南并访问编辑器工具。' },
        aiDesc: { en: 'Click this magic button to generate a complete, multilingual walking tour about any topic!', es: '¡Haz clic en este botón mágico para generar un tour a pie completo y multilingüe sobre cualquier tema!', fr: 'Cliquez sur ce bouton magique pour générer une visite à pied complète et multilingue sur n\'importe quel sujet !', de: 'Klicken Sie auf diesen magischen Knopf, um eine vollständige, mehrsprachige Wanderung zu jedem Thema zu erstellen!', zh: '点击这个神奇的按钮，生成关于任何主题的完整多语言徒步导览！' },
        manualDesc: { en: 'You can also create a new guide from scratch and add points of interest yourself.', es: 'También puedes crear una nueva guía desde cero y añadir los puntos de interés tú mismo.', fr: 'Vous pouvez également créer un nouveau guide à partir de zéro et ajouter vous-même des points d\'intérêt.', de: 'Sie können auch eine neue Anleitung von Grund auf neu erstellen und selbst Sehenswürdigkeiten hinzufügen.', zh: '您也可以从头开始创建新指南并自己添加兴趣点。' },
        importerDesc: { en: 'Use these buttons to import guides from a JSON file or export all your current guides to a backup file.', es: 'Usa estos botones para importar guías desde un archivo JSON o exportar todas tus guías actuales a un archivo de respaldo.', fr: 'Utilisez ces boutons pour importer des guides à partir d\'un fichier JSON ou exporter tous vos guides actuels dans un fichier de sauvegarde.', de: 'Verwenden Sie diese Schaltflächen, um Anleitungen aus einer JSON-Datei zu importieren oder alle Ihre aktuellen Anleitungen in eine Sicherungsdatei zu exportieren.', zh: '使用这些按钮从JSON文件导入指南或将所有当前指南导出到备份文件。' },
        languageDesc: { en: 'Change the application language and the language for filtering guides.', es: 'Cambia el idioma de la aplicación y el idioma para filtrar las guías.', fr: 'Changez la langue de l\'application et la langue de filtrage des guides.', de: 'Ändern Sie die Anwendungssprache und die Sprache zum Filtern der Anleitungen.', zh: '更改应用程序语言和筛选指南的语言。' },
        sessionDesc: { en: 'Here you can see your user information and log out.', es: 'Aquí puedes ver la información de tu usuario y cerrar sesión.', fr: 'Ici, vous pouvez voir vos informations utilisateur et vous déconnecter.', de: 'Hier können Sie Ihre Benutzerinformationen einsehen und sich abmelden.', zh: '在这里您可以看到您的用户信息并注销。' },
        // Buttons
        back: { en: 'Back', es: 'Atrás', fr: 'Retour', de: 'Zurück', zh: '返回' },
        skip: { en: 'Skip', es: 'Saltar', fr: 'Passer', de: 'Überspringen', zh: '跳过' },
        next: { en: 'Next', es: 'Siguiente', fr: 'Suivant', de: 'Weiter', zh: '下一个' },
        finish: { en: 'Finish', es: 'Terminar', fr: 'Terminer', de: 'Fertig', zh: '完成' }
    };

    function startEditorTutorial() {
        // First, ensure the header controls are updated.
        updateHeaderControls();
        // Then, ensure the correct sidebar view is active.
        switchSidebarView('guides');

        // Defer the rest of the tutorial logic until the next animation frame.
        // This ensures the DOM has been updated by the functions above before we query it.
        requestAnimationFrame(() => {
            // Safeguard: Now that the DOM should be ready, check if the key element exists.
            if (!document.getElementById('ac-generate-guide-btn')) {
                console.warn("Tutorial skipped: Editor controls not visible even after render.");
                return;
            }

            const l = selectedLanguage || 'en';
            const steps = [
                { element: '#logo-btn', title: tutorialStrings.welcome[l], text: tutorialStrings.guidesListDesc[l], position: 'right' },
                { element: '#activity-map-btn', title: tutorialStrings.mapView[l], text: tutorialStrings.mapViewDesc[l], position: 'right' },
                { element: '#ac-generate-guide-btn', title: tutorialStrings.createAI[l], text: tutorialStrings.aiDesc[l], position: 'right' },
                { element: '#ac-create-guide-btn', title: tutorialStrings.createManual[l], text: tutorialStrings.manualDesc[l], position: 'right' },
                { element: '#ac-import-guides-btn', title: tutorialStrings.importer[l], text: tutorialStrings.importerDesc[l], position: 'right' },
                { element: '#lang-btn', title: tutorialStrings.language[l], text: tutorialStrings.languageDesc[l], position: 'right' },
                { element: '#auth-container-activity', title: tutorialStrings.session[l], text: tutorialStrings.sessionDesc[l], position: 'right' }
            ];

            let currentStep = 0;
            let overlay, tooltip;

            function showStep(stepIndex) {
                const step = steps[stepIndex];
                console.log(`Showing tutorial step ${stepIndex} for element ${step.element}`);
                const targetElement = document.querySelector(step.element);
                if (!targetElement) {
                    console.warn('Tutorial element not found:', step.element);
                    cleanup();
                    return;
                }

                const arrowClass = {
                    right: 'left',
                    top: 'up',
                    down: 'down'
                }[step.position] || 'down';

                // Create tooltip
                tooltip = document.createElement('div');
                tooltip.className = 'tooltip-box';
                const backButtonHTML = stepIndex > 0 ? `<button class="btn-modern btn-modern-secondary" id="back-tutorial">${tutorialStrings.back[l]}</button>` : '';

                tooltip.innerHTML = `
                    <h4>${step.title}</h4>
                    <p>${step.text}</p>
                    <div class="tooltip-actions">
                        <button class="btn-modern btn-modern-secondary" id="skip-tutorial">${tutorialStrings.skip[l]}</button>
                        <div>
                            ${backButtonHTML}
                            <button class="btn-modern" id="next-tutorial">${stepIndex === steps.length - 1 ? tutorialStrings.finish[l] : tutorialStrings.next[l]}</button>
                        </div>
                    </div>
                    <div class="tooltip-arrow ${arrowClass}"></div>
                `;
                tooltip.style.opacity = '0'; // Hide for positioning
                document.body.appendChild(tooltip);

                // Position tooltip
                const targetRect = targetElement.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect(); // Now has dimensions

                switch (step.position) {
                    case 'right':
                        tooltip.style.left = `${targetRect.right + 15}px`;
                        tooltip.style.top = `${targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2)}px`;
                        break;
                    case 'top':
                        tooltip.style.left = `${targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2)}px`;
                        tooltip.style.top = `${targetRect.top - tooltipRect.height - 15}px`;
                        break;
                    default: // 'down'
                        tooltip.style.top = `${targetRect.bottom + 10}px`;
                        tooltip.style.left = `${targetRect.left}px`;
                        break;
                }

                // Final check to ensure the tooltip is not off-screen vertically
                const finalTooltipRect = tooltip.getBoundingClientRect();
                if (finalTooltipRect.bottom > window.innerHeight) {
                    const newTop = window.innerHeight - finalTooltipRect.height - 10; // 10px padding from bottom
                    tooltip.style.top = `${newTop}px`;
                }

                tooltip.style.opacity = '1'; // Make it visible

                // Event listeners
                tooltip.querySelector('#skip-tutorial').onclick = cleanup;
                if (stepIndex > 0) {
                    tooltip.querySelector('#back-tutorial').onclick = () => {
                        currentStep--;
                        tooltip.remove();
                        showStep(currentStep);
                    };
                }
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
            }

            // Start the tutorial
            overlay = document.createElement('div');
            overlay.className = 'tooltip-overlay';
            document.body.appendChild(overlay);
            showStep(currentStep);
        });
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

                    // 1. Translate the main UI
                    translateUI(code);

                    // 2. Refresh the guide list with the new language
                    fetchAndDisplayGuides();

                    // 3. If a guide is currently open, try to switch its language
                    if (currentGuide && currentGuide.available_langs.includes(code)) {
                        switchGuideLanguage(code);
                    }

                    // 4. Ensure the guides view is active if we are not in a guide context
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

            // Attempt to sync with the backend. This will run in the background.
            syncWithSupabase();

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
                translateUI(lang); // Translate UI on first load

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

    function setupMobileConsole() {
        const consoleEl = document.getElementById('mobile-console');
        const contentEl = document.getElementById('mobile-console-content');
        const toggleBtn = document.getElementById('mobile-console-toggle');
        const closeBtn = document.getElementById('mobile-console-close');
        const clearBtn = document.getElementById('mobile-console-clear');

        toggleBtn.addEventListener('click', () => consoleEl.classList.toggle('hidden'));
        closeBtn.addEventListener('click', () => consoleEl.classList.add('hidden'));
        clearBtn.addEventListener('click', () => contentEl.innerHTML = '');

        function createLogMessage(message, level) {
            const p = document.createElement('p');
            p.className = `log-${level}`;
            // Attempt to stringify objects for better readability
            const formattedMessage = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
            p.textContent = `[${level.toUpperCase()}] ${formattedMessage}`;
            contentEl.appendChild(p);
            // Auto-scroll to the bottom
            contentEl.scrollTop = contentEl.scrollHeight;
        }

        const originalConsole = { ...console };
        console.log = function(...args) {
            originalConsole.log(...args);
            args.forEach(arg => createLogMessage(arg, 'log'));
        };
        console.warn = function(...args) {
            originalConsole.warn(...args);
            args.forEach(arg => createLogMessage(arg, 'warn'));
        };
        console.error = function(...args) {
            originalConsole.error(...args);
            args.forEach(arg => createLogMessage(arg, 'error'));
        };
    }

    async function syncWithSupabase() {
        if (!navigator.onLine) {
            console.log("Offline. Skipping sync with Supabase.");
            return;
        }
        console.log("Online. Syncing with Supabase...");

        try {
            // Fetch all published guides
            const { data: guides, error: guidesError } = await supabase
                .from('guides')
                .select('*')
                .eq('status', 'published');

            if (guidesError) throw guidesError;

            // Fetch all POIs for the published guides
            const guideIds = guides.map(g => g.id);
            const { data: pois, error: poisError } = await supabase
                .from('guide_poi')
                .select('*')
                .in('guide_id', guideIds);

            if (poisError) throw poisError;

            // Use a transaction to clear and bulk-add data
            await db.transaction('rw', db.guides, db.guide_poi, async () => {
                // Clear existing data
                await db.guides.clear();
                await db.guide_poi.clear();

                // Add new data
                await db.guides.bulkAdd(guides);
                await db.guide_poi.bulkAdd(pois);
            });

            console.log(`Sync from Supabase complete. Stored ${guides.length} guides and ${pois.length} POIs locally.`);

            // Refresh the guide list now that the sync is complete
            await fetchAndDisplayGuides();

            // PHASE 2: Sync local mutations back to Supabase
            const localMutations = await db.mutations.orderBy('createdAt').toArray();
            if (localMutations.length > 0) {
                console.log(`Found ${localMutations.length} local mutations to sync.`);
                let failedMutations = 0;

                for (const mutation of localMutations) {
                    try {
                        let error = null;
                        switch (mutation.type) {
                            case 'rate_guide':
                                ({ error } = await supabase.rpc('rate_guide', {
                                    guide_id_to_rate: mutation.payload.guideId,
                                    rating_value: mutation.payload.ratingValue
                                }));
                                break;
                            case 'guide_create':
                                ({ error } = await supabase.from('guides').insert(mutation.payload));
                                break;
                            case 'poi_upsert':
                                ({ error } = await supabase.from('guide_poi').upsert(mutation.payload));
                                break;
                            case 'poi_delete':
                                ({ error } = await supabase.from('guide_poi').delete().eq('id', mutation.payload.id));
                                break;
                            case 'guide_delete':
                                ({ error } = await supabase.from('guides').delete().eq('id', mutation.payload.id));
                                break;
                        }

                        if (error) {
                            // Throw to be caught by the catch block
                            throw error;
                        } else {
                            // On successful sync, delete the mutation from the outbox
                            await db.mutations.delete(mutation.id);
                            console.log(`Successfully synced mutation ${mutation.id} (${mutation.type}).`);
                        }
                    } catch (error) {
                        failedMutations++;
                        console.error(`Failed to sync mutation ${mutation.id} (${mutation.type}):`, error);
                        // Update the mutation record with error info instead of stopping
                        await db.mutations.update(mutation.id, {
                            error_count: (mutation.error_count || 0) + 1,
                            last_error_message: error.message
                        });
                    }
                }

                if (failedMutations > 0) {
                    alert(`${failedMutations} local changes could not be synced. Please check the console for details.`);
                } else {
                    console.log("Local mutations sync complete.");
                }
            }

        } catch (error) {
            console.error("Supabase sync failed:", error);
            alert(`Data synchronization failed: ${error.message}`);
        }
    }

    function updateOnlineStatus() {
        const indicator = document.getElementById('online-status-indicator');
        if (navigator.onLine) {
            indicator.classList.remove('offline');
            indicator.classList.add('online');
            indicator.title = 'Online';
            // Attempt to sync any pending changes when coming online
            syncWithSupabase();
        } else {
            indicator.classList.remove('online');
            indicator.classList.add('offline');
            indicator.title = 'Offline';
        }
    }

    async function registerPeriodicSync() {
        if ('serviceWorker' in navigator && 'PeriodicSyncManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            try {
                await registration.periodicSync.register('sync-guides', {
                    minInterval: 24 * 60 * 60 * 1000, // 24 hours
                });
                console.log('Periodic sync registered');
            } catch (error) {
                console.error('Periodic sync could not be registered:', error);
            }
        } else {
            console.log('Periodic Background Sync not supported.');
        }
    }

    // Replace direct call with DOMContentLoaded
    init();
    setupMobileConsole();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus(); // Set initial status
    registerPeriodicSync();
    //document.addEventListener('DOMContentLoaded', init);

});

