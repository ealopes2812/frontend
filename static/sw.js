// Service Worker Otimizado - PWA Ultra-Rápido
// Versão: 3.2 - Mobile App First + Dynamic Manifest

const CACHE_NAME = 'wifimaxx-v3.2';
const STATIC_CACHE = 'wifimaxx-static-v3.2';
const API_CACHE = 'wifimaxx-api-v3.2';

// Recursos críticos para cache imediato
const CRITICAL_RESOURCES = [
    '/',
    '/mobile',
    '/manifest.json',
    '/static/style.css',
    '/static/mobile-optimizations.css',
    '/static/mobile-optimizations.js',
    '/static/logo.png'
];

// Install - Cache recursos críticos imediatamente
self.addEventListener('install', event => {
    console.log('🚀 SW: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('💾 SW: Caching critical resources');
                return cache.addAll(CRITICAL_RESOURCES);
            })
            .then(() => {
                console.log('✅ SW: Critical resources cached');
                return self.skipWaiting(); // Ativar imediatamente
            })
    );
});

// Activate - Limpar caches antigos
self.addEventListener('activate', event => {
    console.log('✅ SW: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME && 
                            cacheName !== STATIC_CACHE && 
                            cacheName !== API_CACHE) {
                            console.log('🗑️ SW: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('🎯 SW: Taking control of all pages');
                return self.clients.claim();
            })
    );
});

// Fetch - Estratégias de cache inteligentes
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // API calls - Cache com fallback para rede
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(cacheFirstApi(event.request));
        return;
    }
    
    // Recursos estáticos - Cache first
    if (url.pathname.startsWith('/static/')) {
        event.respondWith(cacheFirstStatic(event.request));
        return;
    }
    
    // Páginas HTML - Network first com cache fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(networkFirstPage(event.request));
        return;
    }
    
    // Outros recursos - Cache first
    event.respondWith(cacheFirst(event.request));
});

// Estratégia: Cache First para recursos estáticos
async function cacheFirstStatic(request) {
    try {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        
        if (cached) {
            // Retorna do cache e atualiza em background
            updateInBackground(cache, request);
            return cached;
        }
        
        // Não está no cache, busca da rede
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
        
    } catch (error) {
        console.error('SW: Static cache error:', error);
        return new Response('Offline', { status: 503 });
    }
}

// Estratégia: Cache First para API com TTL
async function cacheFirstApi(request) {
    try {
        const cache = await caches.open(API_CACHE);
        const cached = await cache.match(request);
        
        if (cached) {
            const cacheDate = new Date(cached.headers.get('sw-cache-date'));
            const now = new Date();
            const age = (now - cacheDate) / 1000; // segundos
            
            // Cache válido por 5 minutos para API
            if (age < 300) {
                console.log('� SW: API cache hit (age: ' + Math.round(age) + 's)');
                return cached;
            }
        }
        
        // Cache expirado ou não existe, busca da rede
        const response = await fetch(request);
        if (response.ok) {
            const responseClone = response.clone();
            const responseWithDate = new Response(responseClone.body, {
                status: responseClone.status,
                statusText: responseClone.statusText,
                headers: {
                    ...Object.fromEntries(responseClone.headers.entries()),
                    'sw-cache-date': new Date().toISOString()
                }
            });
            cache.put(request, responseWithDate);
        }
        return response;
        
    } catch (error) {
        console.error('SW: API cache error:', error);
        // Retorna cache mesmo expirado se offline
        const cache = await caches.open(API_CACHE);
        const cached = await cache.match(request);
        return cached || new Response('Offline', { status: 503 });
    }
}

// Estratégia: Network First para páginas
async function networkFirstPage(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
        
    } catch (error) {
        console.log('SW: Network failed, trying cache...');
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        return cached || new Response('Offline', { 
            status: 503,
            headers: { 'Content-Type': 'text/html' },
            body: '<h1>Offline</h1><p>Você está offline. Verifique sua conexão.</p>'
        });
    }
}

// Estratégia: Cache First genérica
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    return cached || fetch(request);
}

// Atualização em background
async function updateInBackground(cache, request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            await cache.put(request, response);
        }
    } catch (error) {
        console.log('SW: Background update failed:', error);
    }
}

console.log('🎯 Service Worker v2.0 carregado e otimizado!');

// === ATIVAÇÃO ===
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker: Ativando...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('🗑️ Service Worker: Removendo cache antigo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker: Ativado e pronto!');
                return self.clients.claim();
            })
    );
});

// === ESTRATÉGIAS DE CACHE ===

// Cache First (para recursos estáticos)
const cacheFirst = async (request) => {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.warn('⚠️ Cache First falhou para:', request.url);
        return new Response('Recurso não disponível offline', { status: 503 });
    }
};

// Network First (para APIs e dados dinâmicos)
const networkFirst = async (request) => {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.warn('⚠️ Network First: Buscando no cache para:', request.url);
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Resposta offline personalizada para APIs
        return new Response(
            JSON.stringify({
                error: 'Offline',
                message: 'Dados não disponíveis offline'
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
};

// Stale While Revalidate (para recursos que podem ser atualizados em background)
const staleWhileRevalidate = async (request) => {
    const cachedResponse = await caches.match(request);
    
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            const cache = caches.open(DYNAMIC_CACHE);
            cache.then(c => c.put(request, networkResponse.clone()));
        }
        return networkResponse;
    }).catch(() => cachedResponse);
    
    return cachedResponse || fetchPromise;
};

// === INTERCEPTAÇÃO DE REQUESTS ===
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Ignorar requests que não são GET
    if (request.method !== 'GET') {
        return;
    }
    
    // Ignorar requests de chrome-extension
    if (url.protocol === 'chrome-extension:') {
        return;
    }
    
    // Network First para APIs
    if (NETWORK_FIRST.some(pattern => url.pathname.startsWith(pattern))) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Cache First para recursos estáticos
    if (STATIC_ASSETS.includes(url.pathname) || 
        url.hostname === 'cdn.jsdelivr.net') {
        event.respondWith(cacheFirst(request));
        return;
    }
    
    // Stale While Revalidate para páginas HTML
    if (request.headers.get('Accept')?.includes('text/html')) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }
    
    // Cache First para outros recursos
    event.respondWith(cacheFirst(request));
});

// === SINCRONIZAÇÃO EM BACKGROUND ===
self.addEventListener('sync', (event) => {
    console.log('🔄 Service Worker: Sincronização em background:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

const doBackgroundSync = async () => {
    try {
        // Sincronizar dados pendentes quando a conexão retornar
        const cache = await caches.open(DYNAMIC_CACHE);
        const requests = await cache.keys();
        
        // Verificar se há dados para sincronizar
        console.log('📊 Service Worker: Sincronizando dados...');
        
        // Aqui você pode implementar lógica específica de sincronização
        // Por exemplo, enviar dados que ficaram pendentes offline
        
    } catch (error) {
        console.error('❌ Service Worker: Erro na sincronização:', error);
    }
};

// === NOTIFICAÇÕES PUSH ===
self.addEventListener('push', (event) => {
    console.log('📱 Service Worker: Notificação push recebida');
    
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body || 'Nova atualização disponível',
            icon: '/static/logo.png',
            badge: '/static/logo.png',
            vibrate: [100, 50, 100],
            data: data.data || {},
            actions: [
                {
                    action: 'open',
                    title: 'Abrir',
                    icon: '/static/logo.png'
                },
                {
                    action: 'close',
                    title: 'Fechar'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(
                data.title || 'WiFiMaxx Monitor',
                options
            )
        );
    }
});

// === CLIQUE EM NOTIFICAÇÕES ===
self.addEventListener('notificationclick', (event) => {
    console.log('👆 Service Worker: Notificação clicada');
    
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/dashboard')
        );
    }
});

// === UTILS ===
const isOnline = () => {
    return navigator.onLine;
};

const getNetworkType = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection ? connection.effectiveType : 'unknown';
};

// === LOGGING E DEBUGGING ===
const logCacheStatus = async () => {
    try {
        const cacheNames = await caches.keys();
        console.log('📋 Service Worker: Caches ativos:', cacheNames);
        
        for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const requests = await cache.keys();
            console.log(`📦 Cache ${cacheName}: ${requests.length} itens`);
        }
    } catch (error) {
        console.error('❌ Service Worker: Erro ao verificar caches:', error);
    }
};

// Log inicial
console.log('🚀 Service Worker WiFiMaxx Monitor carregado!');
console.log('📊 Status:', {
    online: isOnline(),
    networkType: getNetworkType(),
    timestamp: new Date().toISOString()
});

// Log do status do cache periodicamente (apenas em desenvolvimento)
if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    setInterval(logCacheStatus, 30000); // A cada 30 segundos
}
