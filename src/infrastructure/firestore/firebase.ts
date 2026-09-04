import * as admin from 'firebase-admin';
import * as fireorm from 'fireorm';

import { config } from 'dotenv';
config();

export function initializeFirebase() {
	if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
		throw new Error('FIREBASE_SERVICE_ACCOUNT is not defined');
	}

	let serviceAccount: Record<string, any>;
	try {
		serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
	} catch {
		throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
	}

	if (typeof serviceAccount.private_key === 'string') {
		serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
	}

	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
	});

	const firestore = admin.firestore();
	fireorm.initialize(firestore);

	console.log(`🚀 Firestore initialized (project: ${serviceAccount.project_id})`);
}
