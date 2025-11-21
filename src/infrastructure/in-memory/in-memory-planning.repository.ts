import { PlanningRepository } from '../../app/domain/repositories/planning.repository';
import { IPlanningEntryEntity, PlanningEntry, PlanningProject } from '../../app/domain/entities/planning.entity';

type Stored = IPlanningEntryEntity & {
	lastSyncKey?: string;
	lastSyncAt?: Date;
	absenceIds?: string[];
	absentsNames?: string[];
};
const entriesByKey = new Map<string, Stored>();

export class InMemoryPlanningRepository implements PlanningRepository {
	async findNotSyncedOnForGuild(guildId: string, syncKey?: string): Promise<IPlanningEntryEntity[]> {
		const effectiveKey = syncKey ?? PlanningEntry.getTodaySyncKey(guildId);
		return Array.from(entriesByKey.values()).filter(
			(e) => e.discord?.guildId === guildId && e.lastSyncKey !== effectiveKey
		);
	}

	async findAllForGuild(guildId: string): Promise<IPlanningEntryEntity[]> {
		return Array.from(entriesByKey.values())
			.filter((e) => e.discord?.guildId === guildId)
			.sort((a, b) => a.date.getTime() - b.date.getTime());
	}

	async upsertByDateAndGuild(entry: IPlanningEntryEntity): Promise<void> {
		const key = PlanningEntry.computeId(entry.date, entry.discord.guildId);
		const stored: Stored = {
			...(entry as any),
			lastSyncKey: PlanningEntry.getTodaySyncKey(entry.discord.guildId),
			lastSyncAt: new Date(),
		};
		entriesByKey.set(key, stored);
	}

	async deleteByDateAndGuild(date: Date, guildId: string): Promise<void> {
		const key = PlanningEntry.computeId(date, guildId);
		entriesByKey.delete(key);
	}

	async addAbsence(date: Date, guildId: string, absenceId: string): Promise<void> {
		const key = PlanningEntry.computeId(date, guildId);
		const existing = entriesByKey.get(key);
		if (!existing) return;
		existing.absenceIds = Array.from(new Set([...(existing.absenceIds || []), absenceId]));
		entriesByKey.set(key, existing);
	}

	async findAllFuture(guildId: string, project?: PlanningProject): Promise<IPlanningEntryEntity[]> {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		return Array.from(entriesByKey.values())
			.filter((e) => e.discord?.guildId === guildId && e.date.getTime() >= start.getTime() && e.project === project)
			.sort((a, b) => a.date.getTime() - b.date.getTime());
	}
}
