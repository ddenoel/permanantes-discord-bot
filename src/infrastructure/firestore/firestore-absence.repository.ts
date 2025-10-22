import { getRepository } from 'fireorm';
import { AbsenceRepository } from '../../app/domain/repositories/absence.repostiory';
import { AbsenceModel } from './models/absence.model';
import { Absence } from '../../app/domain/entities/absence.entity';
import * as admin from 'firebase-admin';

export class FirestoreAbsenceRepository implements AbsenceRepository {
	private get ormRepo() {
		return getRepository(AbsenceModel);
	}

	private get firestore() {
		return admin.firestore();
	}

	private toDomain(model: AbsenceModel): Absence {
		return new Absence(model);
	}

	private toPersistence(absence: Absence): AbsenceModel {
		const model = new AbsenceModel();
		model.id = absence.id;
		model.discord = absence.discord;
		model.absenceDate = absence.absenceDate;
		model.createdAt = absence.createdAt;
		model.message = absence.message;

		return model;
	}

	private documentDataToDomain(data: admin.firestore.DocumentData) {
		const { id, discord, absenceDate, createdAt, message } = data;

		return new Absence({
			id,
			discord,
			absenceDate: new Date(absenceDate._seconds * 1000),
			createdAt: new Date(createdAt._seconds * 1000),
			message,
		});
	}

	async findByDateAndGuild(date: Date, guildId: string): Promise<Absence[]> {
		const absences = await this.firestore
			.collection('absences')
			.where('absenceDate', '==', date)
			.where('discord.guildId', '==', guildId)
			.get();

		return absences.docs.map((doc) => this.documentDataToDomain(doc.data()));
	}

	async findByUserAndGuildSince(userId: string, guildId: string, since: Date): Promise<Absence[]> {
		const absences = await this.firestore
			.collection('absences')
			.where('discord.guildId', '==', guildId)
			.where('discord.member.id', '==', userId)
			.where('absenceDate', '>=', since)
			.orderBy('absenceDate', 'asc')
			.get();

		return absences.docs.map((doc) => this.documentDataToDomain(doc.data()));
	}

	async save(absence: Absence): Promise<void> {
		const model = this.toPersistence(absence);

		await this.ormRepo.create(model);

		return;
	}
}
