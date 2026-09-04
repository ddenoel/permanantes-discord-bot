import { PermanantesConfigService } from '../app/domain/services/permanantes-config.service';
import { FirestorePermanantesConfigRepository } from './firestore/firestore-permanantes-config.repository';
import { InMemoryPermanantesConfigRepository } from './in-memory/in-memory-permanantes-config.repository';

let firebaseAvailable: boolean | null = null;
let singleton: PermanantesConfigService | null = null;

export function setFirebaseAvailable(available: boolean): void {
	firebaseAvailable = available;
	singleton = null;
}

export function createPermanantesConfigService(): PermanantesConfigService {
	if (singleton) return singleton;

	const useInMemory = firebaseAvailable === false;
	const repo = useInMemory
		? new InMemoryPermanantesConfigRepository()
		: new FirestorePermanantesConfigRepository();
	singleton = new PermanantesConfigService(repo);
	return singleton;
}
