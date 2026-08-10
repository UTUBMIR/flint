// Template for the generated service worker. Do not edit directly.
// Regenerate with: npm run build:js (default) or npm run build:cdn (cdn)

const CACHE_NAME = "flint-cache-v1";
const PRECACHE = __PRECACHE__;

const SHELL_PATTERNS = [
    /\/index\.html$/,
    /\/style\.css$/,
    /\/dist\/main\.(js|css)$/
];

async function addAllSafely(cache, urls) {
    await Promise.allSettled(
        urls.map(async (url) => {
            try {
                const request = new Request(url, { mode: "cors" });
                const response = await fetch(request);
                if (response.ok || response.type === "opaque") {
                    await cache.put(request, response);
                }
            } catch {
                // Ignore: degrades to runtime caching for unavailable assets.
            }
        })
    );
}

async function cacheResponse(request, response) {
    if (!request || request.method !== "GET" || !response) return;
    if (response.status !== 200 && response.type !== "opaque") return;

    const cache = await caches.open(CACHE_NAME);
    try {
        await cache.put(request, response);
    } catch {
        // Ignore unsupported requests / caching failures.
    }
}

async function networkFirst(event) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(event.request);
        if (response.ok || response.type === "opaque") {
            await cache.put(event.request, response.clone());
        }
        return response;
    } catch {
        const cached = await cache.match(event.request.url, { ignoreVary: true });
        if (cached) return cached;
        const shellUrl = event.request.url.replace(/\/?[^/]*$/, "/index.html");
        return cache.match(new Request(shellUrl), { ignoreVary: true });
    }
}

async function staleWhileRevalidate(event) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request, { ignoreVary: true });

    const refresh = async () => {
        try {
            const response = await fetch(event.request);
            await cacheResponse(event.request, response.clone());
        } catch {
            // Offline: keep serving the cached copy.
        }
    };

    if (cached) {
        void refresh();
        return cached;
    }

    try {
        const response = await fetch(event.request);
        await cacheResponse(event.request, response.clone());
        return response;
    } catch {
        return Response.error();
    }
}

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => addAllSafely(cache, PRECACHE)).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") return;

    const isShell = SHELL_PATTERNS.some((pattern) => pattern.test(url.pathname));
    const isNavigation = request.mode === "navigate";
    if (isShell || isNavigation) {
        event.respondWith(networkFirst(event));
        return;
    }

    event.respondWith(staleWhileRevalidate(event));
});