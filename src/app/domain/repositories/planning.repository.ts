import { IPlanningEntryEntity } from '../entities/planning.entity';

export interface PlanningRepository {
	/**
	 * Returns planning entries that were not synced on the provided sync key (yyyy-MM-dd).
	 */
	findNotSyncedOnForGuild(guildId: string, syncKey?: string): Promise<IPlanningEntryEntity[]>;

	/**
	 * Creates or updates an entry identified by its date (day-level).
	 */
	upsertByDateAndGuild(entry: IPlanningEntryEntity): Promise<void>;

	/**
	 * Deletes an entry identified by its date (day-level).
	 */
	deleteByDateAndGuild(date: Date, guildId: string): Promise<void>;

	/**
	 * Adds an absence id to the planning entry for the given date and guild.
	 */
	addAbsence(date: Date, guildId: string, absenceId: string): Promise<void>;
}
