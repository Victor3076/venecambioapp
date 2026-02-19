importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase config provided by the user
firebase.initializeApp({
    apiKey: "AIzaSyCYU2Ys7VgIvuKyj6Q6HaBrhbnx-RtrrxI",
    authDomain: "venecambio1pp.firebaseapp.com",
    projectId: "venecambio1pp",
    storageBucket: "venecambio1pp.firebasestorage.app",
    messagingSenderId: "71308474303",
    appId: "1:71308474303:web:48c16d5e6d4d8b8f6f130a"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    // Check if it's a data-only message (from our new backend logic)
    if (payload.data && !payload.notification) {
        const title = payload.data.title || 'Venecambio';
        const options = {
            body: payload.data.body,
            icon: payload.data.icon || '/logo.png',
            badge: '/logo.png',
            data: payload.data // Pass data along so notificationclick can use it
        };

        self.registration.showNotification(title, options);
    }
});

self.addEventListener('notificationclick', function (event) {
    console.log('[firebase-messaging-sw.js] Notification click received.');
    event.notification.close();

    // URL from payload data or default
    const targetUrl = event.notification.data?.url || '/dashboard/transactions';

    event.waitUntil(clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then(function (clientList) {
        // Focus existing tab if available
        for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            if (client.url.includes('/dashboard') && 'focus' in client) {
                return client.focus();
            }
        }
        // Open new window
        if (clients.openWindow) {
            return clients.openWindow(targetUrl);
        }
    }));
});
