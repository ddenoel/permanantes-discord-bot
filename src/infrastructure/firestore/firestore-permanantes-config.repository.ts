import * as admin from 'firebase-admin';
import { IPermanantesConfig, PermanantesConfig } from '../../app/domain/entities/permanantes-config.entity';
import { PermanantesConfigRepository } from '../../app/domain/repositories/permanantes-config.repository';

const COLLECTION = 'permanantes_config';

export class FirestorePermanantesConfigRepository implements PermanantesConfigRepository {
	private get firestore() {
		return admin.firestore();
	}

	async findByGuildId(guildId: string): Promise<IPermanantesConfig | null> {
		const byId = await this.firestore.collection(COLLECTION).doc(guildId).get();
		if (byId.exists) {
			return new PermanantesConfig(byId.data() as IPermanantesConfig).withGuildId(guildId).toInterface();
		}

		const byField = await this.firestore
			.collection(COLLECTION)
			.where('discord.guildId', '==', guildId)
			.limit(1)
			.get();
		if (byField.empty) return null;

		const doc = byField.docs[0];
		return new PermanantesConfig(doc.data() as IPermanantesConfig).withGuildId(guildId).toInterface();
	}

	async save(guildId: string, config: IPermanantesConfig): Promise<void> {
		const payload = new PermanantesConfig(config).withGuildId(guildId).toInterface();
		await this.firestore.collection(COLLECTION).doc(guildId).set(payload, { merge: false });
	}
}
