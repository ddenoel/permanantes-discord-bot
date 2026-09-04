import { PlanningRepository } from '../domain/repositories/planning.repository';
import { IPlanningEntryEntity, PlanningEntry } from '../domain/entities/planning.entity';
import { PlanningSheet } from '../../infrastructure/google/planning-sheet';
import { AbsenceRepository } from '../domain/repositories/absence.repostiory';
import { DateUtils } from '../domain/utils/dates.utils';

export class SyncPlanningFromGoogle {
	constructor(
		private readonly planningRepo: PlanningRepository,
		private readonly planningSheet: PlanningSheet,
		private readonly absenceRepo: AbsenceRepository
	) {}

	private async buildSheetMap(guildId: string): Promise<{
		byKey: Map<string, IPlanningEntryEntity>;
		total: number;
		errorsCount: number;
		errorDates: Date[];
	}> {
		const input = await this.planningSheet.readFile();
		const byKey = new Map<string, IPlanningEntryEntity>();
		let errorsCount = 0;
		const errorDates: Date[] = [];
		for (const item of input) {
			if (!item?.entry) continue;
			try {
				const sheetEntry = item.entry as any;
				const base: Omit<IPlanningEntryEntity, 'id' | 'lastSyncKey'> = {
					...sheetEntry,
					absences: [],
					discord: { guildId },
					lastSyncAt: undefined,
					project: PlanningEntry.parseProject(sheetEntry.project),
				};
				const absences = await this.absenceRepo.findByDateAndGuild(base.date, guildId);
				const entity = new PlanningEntry({ ...base, absences });
				byKey.set(entity.id, entity.toInterface());
			} catch {
				errorsCount++;
				const maybeDate: Date = (item.entry as any)?.date;
				if (maybeDate instanceof Date) errorDates.push(maybeDate);
			}
		}
		return { byKey, total: input.length, errorsCount, errorDates };
	}

	private entriesAreEqual(a: IPlanningEntryEntity, b: IPlanningEntryEntity): boolean {
		if (!a || !b) return false;
		const sameDate = DateUtils.isSameDay(a.date, b.date);
		return (
			sameDate &&
			(a.startDateTime ? a.startDateTime.getTime() : null) === (b.startDateTime ? b.startDateTime.getTime() : null) &&
			(a.endDateTime ? a.endDateTime.getTime() : null) === (b.endDateTime ? b.endDateTime.getTime() : null) &&
			(a.location?.name || '').trim() === (b.location?.name || '').trim() &&
			(a.type || '') === (b.type || '') &&
			(a.project || '') === (b.project || '') &&
			(a.what || '').trim() === (b.what || '').trim() &&
			(a.otherInfos || '').trim() === (b.otherInfos || '').trim() &&
			(a.seanceType || '').trim().toLowerCase() === (b.seanceType || '').trim().toLowerCase()
		);
	}

	private async resolveSeasonStartYear(byKey: Map<string, IPlanningEntryEntity>): Promise<number> {
		const sheetName = await this.planningSheet.getSheetName();
		const fromName = DateUtils.parseSeasonYearsFromSheetName(sheetName);
		if (fromName) {
			return fromName.startYear;
		}

		for (const entry of byKey.values()) {
			if (entry?.date instanceof Date) {
				return DateUtils.getSeasonYearsForDate(entry.date).startYear;
			}
		}

		return DateUtils.getSeasonYearsForDate(new Date()).startYear;
	}

	private shouldDeleteDuringSync(date: Date, seasonStartYear: number): boolean {
		return DateUtils.isDateInSeason(date, seasonStartYear);
	}

	private async syncSimple(
		guildId: string,
		force: boolean
	): Promise<{ createdOrUpdated: number; deleted: number; errors: number }> {
		const { byKey, errorsCount } = await this.buildSheetMap(guildId);
		const seasonStartYear = await this.resolveSeasonStartYear(byKey);
		const seasonRange = DateUtils.getSeasonRange(seasonStartYear);
		console.info(
			`[SyncPlanning] Season ${seasonStartYear}-${seasonStartYear + 1} (${DateUtils.formatDate(seasonRange.start)} → ${DateUtils.formatDate(seasonRange.end)})`
		);

		const existing = force
			? await this.planningRepo.findAllForGuild(guildId)
			: await this.planningRepo.findNotSyncedOnForGuild(guildId);
		const existingKeys = new Set(existing.map((e) => PlanningEntry.computeId(e.date, guildId)));

		let createdOrUpdated = 0;
		for (const [key, entry] of byKey.entries()) {
			await this.planningRepo.upsertByDateAndGuild(entry);
			createdOrUpdated++;
			existingKeys.delete(key);
		}

		let deleted = 0;
		for (const remainingKey of existingKeys) {
			const [y, m, d] = remainingKey.split('-').map((v) => parseInt(v, 10));
			const date = new Date(y, m - 1, d);
			if (!this.shouldDeleteDuringSync(date, seasonStartYear)) {
				continue;
			}
			await this.planningRepo.deleteByDateAndGuild(date, guildId);
			deleted++;
		}

		return { createdOrUpdated, deleted, errors: errorsCount };
	}

	private async syncWithProgress(
		guildId: string,
		force: boolean,
		onProgress?: (evt: {
			stage: string;
			message: string;
			processed?: number;
			total?: number;
			percent?: number;
		}) => void | Promise<void>
	): Promise<{
		createdOrUpdated: number;
		deleted: number;
		errors: number;
		details: {
			created: Date[];
			modified: Date[];
			identical: number;
			deleted: Date[];
			errors: Date[];
		};
	}> {
		try {
			const fileName = await this.planningSheet.getFileName();
			if (onProgress) await onProgress({ stage: 'reading_file', message: `📖 Lecture du fichier _"${fileName}"_...` });
			const { byKey, total, errorsCount, errorDates } = await this.buildSheetMap(guildId);
			const seasonStartYear = await this.resolveSeasonStartYear(byKey);
			const seasonRange = DateUtils.getSeasonRange(seasonStartYear);
			if (onProgress) {
				await onProgress({
					stage: 'entries_found',
					message: `📄 ${total} entrées trouvées · saison ${seasonStartYear}-${seasonStartYear + 1} (${DateUtils.formatDate(seasonRange.start)} → ${DateUtils.formatDate(seasonRange.end)})`,
					total,
				});
			}

			const existing = force
				? await this.planningRepo.findAllForGuild(guildId)
				: await this.planningRepo.findNotSyncedOnForGuild(guildId);
			const existingByKey = new Map(existing.map((e) => [PlanningEntry.computeId(e.date, guildId), e]));

			const createdDates: Date[] = [];
			const modifiedDates: Date[] = [];
			let identicalCount = 0;
			const deletedDates: Date[] = [];

			let processed = 0;
			let lastPercent = -1;
			for (const [key, entry] of byKey.entries()) {
				const existingEntry = existingByKey.get(key);
				if (!existingEntry) {
					await this.planningRepo.upsertByDateAndGuild(entry);
					createdDates.push(entry.date);
				} else if (!this.entriesAreEqual(entry, existingEntry)) {
					await this.planningRepo.upsertByDateAndGuild(entry);
					modifiedDates.push(entry.date);
				} else {
					identicalCount++;
				}
				existingByKey.delete(key);
				processed++;
				const percent = Math.floor((processed / Math.max(total, 1)) * 100);
				if (percent !== lastPercent && onProgress) {
					lastPercent = percent;
					await onProgress({
						stage: 'sync_progress',
						message: `🔄 Synchronisation ${percent}% (${processed}/${total})`,
						processed,
						total,
						percent,
					});
				}
			}

			for (const [, remainingEntry] of existingByKey.entries()) {
				if (!this.shouldDeleteDuringSync(remainingEntry.date, seasonStartYear)) {
					continue;
				}
				await this.planningRepo.deleteByDateAndGuild(remainingEntry.date, guildId);
				deletedDates.push(remainingEntry.date);
			}

			if (onProgress) await onProgress({ stage: 'done', message: '✅ Planning synchronisé !' });

			return {
				createdOrUpdated: createdDates.length + modifiedDates.length,
				deleted: deletedDates.length,
				errors: errorsCount,
				details: {
					created: createdDates,
					modified: modifiedDates,
					identical: identicalCount,
					deleted: deletedDates,
					errors: errorDates,
				},
			};
		} catch (error) {
			if (onProgress) await onProgress({ stage: 'error', message: '❌ Erreur lors de la synchronisation du planning' });
			throw error;
		}
	}

	async execute(
		guildId?: string,
		force: boolean = false,
		withProgress: boolean = false,
		onProgress?: (evt: {
			stage: string;
			message: string;
			processed?: number;
			total?: number;
			percent?: number;
		}) => void | Promise<void>
	): Promise<{ createdOrUpdated: number; deleted: number; errors: number; details?: any }> {
		guildId ??= process.env.GUILD_ID;
		console.log('🚀 Sync Planning FromGoogle starting...');
		if (withProgress) {
			return this.syncWithProgress(guildId, force, onProgress);
		}
		const res = await this.syncSimple(guildId, force);
		console.log(`Planning synced : ${res.createdOrUpdated} upserts, ${res.deleted} deletions, ${res.errors} errors`);
		return res;
	}
}
