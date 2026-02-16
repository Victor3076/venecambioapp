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
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo.png'
    };

    self.registration.showNotification(notificationTitle,
        notificationOptions);
});
