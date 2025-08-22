/* Author: Alberto Arce, Arcasoft (Updated by Jules) */
const CACHE_NAME = 'waywispery-v3';
const urlsToCache = [
    // Core App Shell
    '/',
    '/index.html',
    '/css/style.css',
    '/js/main.js',
    '/manifest.json',
    '/assets/icons/waywispery-icon.jpeg',
    // Third-party Libraries
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://unpkg.com/dexie@latest/dist/dexie.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://unpkg.com/leaflet-geosearch@3.8.0/dist/geosearch.css',
    'https://unpkg.com/leaflet-geosearch@3.8.0/dist/bundle.min.js',
    // Font Awesome Webfonts (critical for offline icons)
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/webfonts/fa-solid-900.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/webfonts/fa-regular-400.woff2',
    // Flag Icons
    'https://flagcdn.com/w40/es.png',
    'https://flagcdn.com/w40/gb.png',
    'https://flagcdn.com/w40/fr.png',
    'https://flagcdn.com/w40/de.png',
    'https://flagcdn.com/w40/cn.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache and caching URLs');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Failed to cache during install:', error);
            })
    );
});

self.addEventListener('fetch', event => {
    // Use a stale-while-revalidate strategy for performance
    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(response => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    // If the request is successful, update the cache
                    if (networkResponse.ok) {
                       // We only cache GET requests to avoid caching API calls
                       if (event.request.method === 'GET' && event.request.url.startsWith('http')) {
                           cache.put(event.request, networkResponse.clone());
                       }
                    }
                    return networkResponse;
                }).catch(err => {
                    console.warn(`[SW] Fetch failed for ${event.request.url}. This is expected if offline.`, err);
                });

                // Return the cached response immediately if available, otherwise wait for the network
                return response || fetchPromise;
            });
        })
    );
});


self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// -----------------------------------------------------------------------------
// Periodic Background Sync Logic
// -----------------------------------------------------------------------------

// Import required libraries
importScripts('https://unpkg.com/dexie@latest/dist/dexie.js');
importScripts('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');

// Duplicated Supabase and Dexie setup
const SUPABASE_URL = 'https://whfcesalellvnrbdcsbb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoZmNlc2FsZWxsdm5yYmRjc2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNTY0NDMsImV4cCI6MjA3MDkzMjQ0M30.wjzU9y1pudSctnLxaIIAfG8FKbMalLbKU4rto99vP9E';
const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const db = new self.Dexie('waywhispery_db');
db.version(3).stores({
    guides: 'id, slug, *available_langs',
    guide_poi: 'id, guide_id',
    mutations: '++id, createdAt, error_count' // Correct schema
});

// Duplicated and adapted sync function
async function syncWithSupabase() {
    console.log("[Service Worker] Starting sync with Supabase...");

    try {
        // --- PHASE 1: Sync local mutations back to Supabase (Upload) ---
        // Note: In SW, we don't have user context. We can only sync non-user-specific mutations
        // or mutations that don't require elevated privileges. For this app, most mutations
        // (create, delete) require a user to be logged in. Rating is an RPC that might work anonymously.
        // This is a limitation of background sync without a robust auth token refresh mechanism.
        const localMutations = await db.mutations.orderBy('createdAt').toArray();
        if (localMutations.length > 0) {
            console.log(`[SW] Found ${localMutations.length} local mutations to sync.`);
            let failedMutations = 0;

            for (const mutation of localMutations) {
                 try {
                    let error = null;
                     // We only attempt to sync ratings, as other actions require auth which we don't have in the SW.
                    if (mutation.type === 'rate_guide') {
                         ({ error } = await supabase.rpc('rate_guide', {
                            guide_id_to_rate: mutation.payload.guideId,
                            rating_value: mutation.payload.ratingValue
                        }));
                    } else {
                        console.log(`[SW] Skipping mutation type '${mutation.type}' as it requires authentication.`);
                        continue; // Skip to the next mutation
                    }

                    if (error) {
                        throw new Error(error.message);
                    } else {
                        await db.mutations.delete(mutation.id);
                        console.log(`[SW] Successfully synced mutation ${mutation.id} (${mutation.type}).`);
                    }
                } catch (err) {
                    failedMutations++;
                    console.error(`[SW] Failed to sync mutation ${mutation.id} (${mutation.type}):`, err);
                    await db.mutations.update(mutation.id, {
                        error_count: (mutation.error_count || 0) + 1,
                        last_error_message: `[SW] ${err.message}`
                    });
                }
            }
        }

        // --- PHASE 2: Fetch latest data from Supabase (Download) ---
        console.log("[SW] Fetching latest data from Supabase...");
        const { data: guides, error: guidesError } = await supabase
            .from('guides')
            .select('*')
            .eq('status', 'published');
        if (guidesError) throw guidesError;

        const guideIds = guides.map(g => g.id);
        let pois = [];
        if (guideIds.length > 0) {
            const { data: fetchedPois, error: poisError } = await supabase
                .from('guide_poi')
                .select('*')
                .in('guide_id', guideIds);
            if (poisError) throw poisError;
            pois = fetchedPois;
        }

        await db.transaction('rw', db.guides, db.guide_poi, async () => {
            await db.guides.clear();
            await db.guide_poi.clear();
            if (guides.length > 0) await db.guides.bulkPut(guides);
            if (pois.length > 0) await db.guide_poi.bulkPut(pois);
        });

        console.log(`[SW] Sync from Supabase complete. Stored ${guides.length} guides and ${pois.length} POIs locally.`);

    } catch (error) {
        console.error("[SW] Supabase sync failed:", error);
    }
}

// Listen for the periodic sync event
self.addEventListener('periodicsync', event => {
    if (event.tag === 'sync-guides') {
        console.log('[SW] Periodic sync event received');
        event.waitUntil(syncWithSupabase());
    }
});
