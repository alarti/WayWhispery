/* Author: Alberto Arce, Arcasoft */
const CACHE_NAME = 'waywispery-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/main.js',
    '/manifest.json',
    '/assets/icons/waywispery-icon.jpeg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
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
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});


// -----------------------------------------------------------------------------
// Periodic Background Sync Logic
// This code is duplicated from main.js due to file constraints.
// -----------------------------------------------------------------------------

// Import required libraries
importScripts('https://unpkg.com/dexie@latest/dist/dexie.js');
importScripts('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');

// Duplicated Supabase and Dexie setup
const SUPABASE_URL = 'https://whfcesalellvnrbdcsbb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoZmNlc2FsZWxsdm5yYmRjc2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNTY0NDMsImV4cCI6MjA3MDkzMjQ0M30.wjzU9y1pudSctnLxaIIAfG8FKbMalLbKU4rto99vP9E';
const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const db = new self.Dexie('waywhispery_db');
db.version(2).stores({
    guides: 'id, slug, *available_langs',
    guide_poi: 'id, guide_id',
    mutations: '++id'
});

// Duplicated sync function
async function syncWithSupabase() {
    console.log("[Service Worker] Starting sync with Supabase...");
    try {
        const { data: guides, error: guidesError } = await supabase
            .from('guides')
            .select('*')
            .eq('status', 'published');
        if (guidesError) throw guidesError;

        const guideIds = guides.map(g => g.id);
        const { data: pois, error: poisError } = await supabase
            .from('guide_poi')
            .select('*')
            .in('guide_id', guideIds);
        if (poisError) throw poisError;

        await db.transaction('rw', db.guides, db.guide_poi, async () => {
            await db.guides.clear();
            await db.guide_poi.clear();
            await db.guides.bulkAdd(guides);
            await db.guide_poi.bulkAdd(pois);
        });
        console.log(`[Service Worker] Sync from Supabase complete.`);

        const localMutations = await db.mutations.orderBy('createdAt').toArray();
        if (localMutations.length > 0) {
            console.log(`[Service Worker] Found ${localMutations.length} local mutations to sync.`);
            for (const mutation of localMutations) {
                let error = null;
                // ... (Mutation handling logic is complex and might need auth, skipping for this example)
                // For simplicity, we assume mutations are handled when app is open.
                // A full implementation would require handling auth in the SW.
            }
        }
    } catch (error) {
        console.error("[Service Worker] Supabase sync failed:", error);
    }
}

// Listen for the periodic sync event
self.addEventListener('periodicsync', event => {
    if (event.tag === 'sync-guides') {
        console.log('Periodic sync event received');
        event.waitUntil(syncWithSupabase());
    }
});
