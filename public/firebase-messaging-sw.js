importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase config
firebase.initializeApp({
    apiKey: "AIzaSyCYU2Ys7VgIvuKyj6Q6HaBrhbnx-RtrrxI",
    authDomain: "venecambio1pp.firebaseapp.com",
    projectId: "venecambio1pp",
    storageBucket: "venecambio1pp.firebasestorage.app",
    messagingSenderId: "71308474303",
    appId: "1:71308474303:web:48c16d5e6d4d8b8f6f130a"
});

const messaging = firebase.messaging();

// PWA installability requirements
self.addEventListener('install', (event) => {
    console.log('[SW] Install event');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activate event');
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only handle GET requests from the same origin.
    // Skip POST/PUT/etc. (e.g. Supabase auth calls) and cross-origin requests
    // so they go directly to the network without the SW interfering.
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        fetch(event.request).catch((err) => {
            // Silently ignore AbortErrors — these happen when the browser
            // cancels a navigation fetch (e.g. when opening the app from
            // a notification tap) and are not real errors.
            if (err && err.name === 'AbortError') {
                return new Response('', { status: 408 });
            }
            throw err;
        })
    );
});

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    // Check if it's a data-only message or standard notification
    if (payload.data && !payload.notification) {
        const title = payload.data.title || 'Venecambio';
        const options = {
            body: payload.data.body,
            icon: payload.data.icon || '/logo.png',
            badge: '/logo.png',
            data: payload.data
        };

        self.registration.showNotification(title, options);
    }
});

self.addEventListener('notificationclick', function (event) {
    console.log('[firebase-messaging-sw.js] Notification click received.');
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/dashboard/transactions';

    event.waitUntil(clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            if (client.url.includes('/dashboard') && 'focus' in client) {
                return client.focus();
            }
        }
        if (clients.openWindow) {
            return clients.openWindow(targetUrl);
        }
    }));
});
