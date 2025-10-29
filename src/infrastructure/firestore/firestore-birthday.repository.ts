import { getRepository } from 'fireorm';
import * as admin from 'firebase-admin';
import { Birthday } from '../../app/domain/entities/birthday.entity';
import { BirthdayRepository } from '../../app/domain/repositories/birthday.repository';
import { BirthdayModel } from './models/birthday.model';

export class FirestoreBirthdayRepository implements BirthdayRepository {
	private get ormRepo() {
		return getRepository(BirthdayModel);
	}

	private get firestore() {
		return admin.firestore();
	}

	static toDomain(model: BirthdayModel): Birthday {
		return new Birthday(model);
	}

	toDomain(model: BirthdayModel): Birthday {
		return FirestoreBirthdayRepository.toDomain(model);
	}

	static toPersistence(entity: Birthday): BirthdayModel {
		const model = new BirthdayModel();
		model.id = entity.id;
		model.birthdayDate = entity.birthdayDate;
		model.member = entity.member;
		model.discordInfo = entity.discordInfo;
		model.createdAt = entity.createdAt;
		return model;
	}

	toPersistence(entity: Birthday): BirthdayModel {
		return FirestoreBirthdayRepository.toPersistence(entity);
	}

	private documentDataToDomain(data: admin.firestore.DocumentData) {
		const { id, birthdayDate, member, discordInfo, createdAt } = data;
		return new Birthday({
			id,
			birthdayDate,
			member,
			discordInfo,
			createdAt: new Date(createdAt._seconds * 1000),
		});
	}

	async save(birthday: Birthday): Promise<void> {
		const model = this.toPersistence(birthday);
		await this.ormRepo.create(model);
	}

	async findByMemberAndGuild(memberId: string, guildId: string): Promise<Birthday | null> {
		const snapshot = await this.firestore
			.collection('birthday')
			.where('discordInfo.guildId', '==', guildId)
			.where('member.id', '==', memberId)
			.limit(1)
			.get();
		if (snapshot.empty) return null;
		const doc = snapshot.docs[0];
		return this.documentDataToDomain(doc.data());
	}

	async update(birthday: Birthday): Promise<void> {
		const model = this.toPersistence(birthday);
		await this.ormRepo.update(model);
	}
}
