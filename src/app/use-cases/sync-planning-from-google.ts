import { PlanningRepository } from '../domain/repositories/planning.repository';
import { IPlanningEntryEntity, PlanningEntry } from '../domain/entities/planning.entity';
import { PlanningSheet } from '../../infrastructure/google/planning-sheet';
import { AbsenceRepository } from '../domain/repositories/absence.repostiory';

export class SyncPlanningFromGoogle {
	constructor(
		private readonly planningRepo: PlanningRepository,
		private readonly planningSheet: PlanningSheet,
		private readonly absenceRepo: AbsenceRepository
	) {}

	async execute(): Promise<{ createdOrUpdated: number; deleted: number; errors: number }> {
		console.log('🚀 Sync Planning FromGoogle starting...');
		const guildId = process.env.GUILD_ID;
		const entries = await this.planningSheet.readFile();
		const byKey = new Map<string, IPlanningEntryEntity>();
		console.log('Entries found in Google Sheet:', entries.length);
		let errorsCount = 0;
		for (const item of entries) {
			if (!item?.entry) {
				continue;
			}
			try {
				const sheetEntry = item.entry as any;
				const base: Omit<IPlanningEntryEntity, 'id' | 'lastSyncKey'> = {
					date: sheetEntry.date,
					startDateTime: sheetEntry.startDateTime,
					endDateTime: sheetEntry.endDateTime,
					location: sheetEntry.location,
					type: sheetEntry.type,
					what: sheetEntry.what,
					otherInfos: sheetEntry.otherInfos,
					absences: [],
					discord: { guildId },
					lastSyncAt: undefined,
				};
				const absences = await this.absenceRepo.findByDateAndGuild(base.date, guildId);
				const entity = new PlanningEntry({ ...base, absences });
				byKey.set(entity.id, entity.toInterface());
			} catch (error) {
				errorsCount++;
				console.error(`Error processing entry at column ${item.col} ${JSON.stringify(item.entry)}:`, error);
			}
		}

		const existingNotSynced = await this.planningRepo.findNotSyncedOnForGuild(guildId);
		const existingKeys = new Set(existingNotSynced.map((e) => PlanningEntry.computeId(e.date, guildId)));

		let createdOrUpdated = 0;
		for (const [key, entry] of byKey.entries()) {
			await this.planningRepo.upsertByDateAndGuild(entry);
			createdOrUpdated++;
			existingKeys.delete(key);
		}

		let deleted = 0;
		for (const remainingKey of existingKeys) {
			const [y, m, d] = remainingKey.split('-').map((v) => parseInt(v, 10));
			await this.planningRepo.deleteByDateAndGuild(new Date(y, m - 1, d), guildId);
			deleted++;
		}

		console.log(`Planning synced : ${createdOrUpdated} upserts, ${deleted} deletions, ${errorsCount} errors`);
		return { createdOrUpdated, deleted, errors: errorsCount };
	}
}
