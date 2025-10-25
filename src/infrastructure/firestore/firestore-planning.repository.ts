import { getRepository } from 'fireorm';
import * as admin from 'firebase-admin';
import { PlanningRepository } from '../../app/domain/repositories/planning.repository';
import { IPlanningEntryEntity, PlanningEntry, PlanningProject } from '../../app/domain/entities/planning.entity';
import { PlanningModel } from './models/planning.model';
import { IAbsenceEntity } from '../../app/domain/entities/absence.entity';

export class FirestorePlanningRepository implements PlanningRepository {
	private get ormRepo() {
		return getRepository(PlanningModel);
	}

	private get firestore() {
		return admin.firestore();
	}

	private toDomain(model: PlanningModel, absences?: IAbsenceEntity[]): IPlanningEntryEntity {
		return {
			id: model.id,
			date: new Date((model.date as any)?._seconds ? (model.date as any)._seconds * 1000 : model.date),
			startDateTime: model.startDateTime
				? new Date(
						(model.startDateTime as any)?._seconds ? (model.startDateTime as any)._seconds * 1000 : model.startDateTime
					)
				: null,
			endDateTime: model.endDateTime
				? new Date(
						(model.endDateTime as any)?._seconds ? (model.endDateTime as any)._seconds * 1000 : model.endDateTime
					)
				: null,
			location: { name: model.location?.name || 'unknown' },
			type: model.type,
			what: model.what,
			absences: [],
			otherInfos: model.otherInfos,
			lastSyncKey: model.lastSyncKey,
			lastSyncAt: model.lastSyncAt,
			discord: model.discord,
			project: model.project,
		};
	}

	private toPersistence(ientry: Omit<IPlanningEntryEntity, 'id' | 'lastSyncKey'>): PlanningModel {
		const entry = new PlanningEntry(ientry).toInterface();

		return {
			id: entry.id,
			date: entry.date,
			startDateTime: entry.startDateTime || null,
			endDateTime: entry.endDateTime || null,
			location: { name: entry.location?.name || 'unknown' },
			type: entry.type,
			what: entry.what,
			otherInfos: entry.otherInfos,
			absenceIds: entry?.absences?.map((absence) => absence.id) || [],
			absentsNames: entry?.absences?.map((absence) => absence.discord.member.displayName) || [],
			lastSyncAt: entry.lastSyncAt,
			lastSyncKey: entry.lastSyncKey,
			discord: entry.discord,
			project: entry.project,
		};
	}

	async findNotSyncedOnForGuild(guildId?: string, syncKey?: string): Promise<IPlanningEntryEntity[]> {
		syncKey ??= PlanningEntry.getTodaySyncKey(guildId);
		const snapshot = await this.firestore
			.collection('planning')
			.where('lastSyncKey', '!=', syncKey)
			.where('discord.guildId', '==', guildId)
			.get();

		return snapshot.docs.map((doc) => this.toDomain(doc.data() as any));
	}

	async upsertByDateAndGuild(entry: IPlanningEntryEntity): Promise<void> {
		const model = this.toPersistence(entry);
		model.lastSyncAt = new Date();

		await this.firestore
			.collection('planning')
			.doc(entry.id ?? PlanningEntry.computeId(entry.date, entry.discord.guildId))
			.set(model, { merge: true });
	}

	async deleteByDateAndGuild(date: Date, guildId: string): Promise<void> {
		const id = PlanningEntry.computeId(date, guildId);
		await this.firestore.collection('planning').doc(id).delete();
	}

	async addAbsence(date: Date, guildId: string, absenceId: string): Promise<void> {
		const id = PlanningEntry.computeId(date, guildId);
		await this.firestore
			.collection('planning')
			.doc(id)
			.set({ absenceIds: (admin.firestore as any).FieldValue.arrayUnion(absenceId) }, { merge: true });
	}

	async findAllFuture(guildId: string, project?: PlanningProject): Promise<IPlanningEntryEntity[]> {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const snapshot = await this.firestore
			.collection('planning')
			.where('discord.guildId', '==', guildId)
			.where('date', '>=', start)
			.where('project', '==', project)
			.orderBy('date', 'asc')
			.get();

		return snapshot.docs.map((doc) => this.toDomain(doc.data() as any));
	}
}
