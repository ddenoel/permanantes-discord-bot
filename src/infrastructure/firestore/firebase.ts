import * as admin from 'firebase-admin';
import * as fireorm from 'fireorm';

import { config } from 'dotenv';
config();

export function initializeFirebase() {
	const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
	});

	const firestore = admin.firestore();
	fireorm.initialize(firestore);

	console.log('🚀 Firestore initialized');
}
