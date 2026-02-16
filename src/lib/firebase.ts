import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";

// Firebase configuration updated with real credentials.
const firebaseConfig = {
    apiKey: "AIzaSyCYU2Ys7VgIvuKyj6Q6HaBrhbnx-RtrrxI",
    authDomain: "venecambio1pp.firebaseapp.com",
    projectId: "venecambio1pp",
    storageBucket: "venecambio1pp.firebasestorage.app",
    messagingSenderId: "71308474303",
    appId: "1:71308474303:web:48c16d5e6d4d8b8f6f130a",
    measurementId: "G-1PKB9HMZ9N"
};

const app = initializeApp(firebaseConfig);

let messaging: Messaging | undefined;

if (typeof window !== "undefined") {
    messaging = getMessaging(app);
}

export { messaging, getToken, onMessage };

export const requestPermission = async () => {
    if (!messaging) return;

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await getToken(messaging, {
                vapidKey: 'BNHpLPlpSVRXK73eeUBmIyEA7g1h-TNalsRUxav5N3ZVFd5a0B5CZx4CWhtGD-PzGWHAlKLbDMlmqZO4Ok3Xmj0' // This is the Web Push certificate Key
            });
            return token;
        }
    } catch (error) {
        console.error("An error occurred while retrieving token. ", error);
    }
    return null;
};
