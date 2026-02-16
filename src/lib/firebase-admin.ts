import * as admin from 'firebase-admin';

const getAdminMessaging = () => {
    if (!admin.apps.length) {
        try {
            const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
            if (!serviceAccountVar) {
                throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing');
            }

            const serviceAccount = JSON.parse(serviceAccountVar);

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        } catch (error) {
            console.error('Firebase admin initialization error:', error);
            throw error;
        }
    }
    return admin.messaging();
};

export { getAdminMessaging };
