import { format, isAfter } from 'date-fns';
import { Absence } from '../../app/domain/entities/absence.entity';
import { AbsenceRepository } from '../../app/domain/repositories/absence.repostiory';
import { Cell, GoogleService } from './google';
import { config } from 'dotenv';
import { PlanningSheet } from './planning-sheet';

config();

export class GoogleSheetAbsenceRepository implements AbsenceRepository {
	private readonly fileId = process.env.GOOGLE_ABSENCES_FILE_ID;

	constructor(
		private googleService: GoogleService,
		private planningSheet: PlanningSheet
	) {}

	async findByDateAndGuild(date: Date, guildId: string): Promise<Absence[]> {
		const data = await this.planningSheet.readFile();

		const compareFormat = 'dd-MM-yyyy';
		const entry = data.find(({ entry }) => format(entry.date, compareFormat) === format(date, compareFormat));

		if (!entry) {
			return [];
		}

		return entry.entry.absences;
	}

	async findByUserAndGuildSince(userId: string, guildId: string, since: Date, userName?: string): Promise<Absence[]> {
		// The Google Sheet does not store Discord user IDs; we fallback to matching by display name when provided
		if (!userName) return [];
		const data = await this.planningSheet.readFile();

		const userEntries = data.filter(
			({ entry }) =>
				isAfter(entry.date, since) && entry.absences.some((absence) => absence.discord.member.displayName === userName)
		);

		return userEntries.flatMap(({ entry }) => entry.absences);
	}

	async setDiscordMessageId(absenceId: string, messageId: string): Promise<void> {
		// Not supported in Google Sheet backend
		return;
	}

	async findById(absenceId: string): Promise<Absence | null> {
		// Not supported in Google Sheet backend
		return null;
	}

	async save(absence: Absence): Promise<void> {
		const compareFormat = 'dd-MM-yyyy';
		const data = await this.planningSheet.readFile();
		const entry = data.find(
			({ entry }) => format(entry.date, compareFormat) === format(absence.absenceDate, compareFormat)
		);

		if (!entry) {
			return;
		}

		const absents = new Set(entry.entry.absences.map((absence) => absence.discord.member.displayName));
		const userName = absence.discord.member.displayName;
		if (absents.has(userName)) {
			return;
		}
		absents.add(userName);

		const cell: Cell = { row: this.planningSheet.getLineIndexFor('absents') + 1, column: entry.col };

		const newValue = Array.from(absents).join(',');

		await this.googleService.editCell(this.fileId, await this.planningSheet.getSheetName(), cell, newValue);

		return;
	}

	async delete(absence: Absence): Promise<void> {
		const userDisplayName = absence.discord.member.displayName;

		const compareFormat = 'dd-MM-yyyy';
		const data = await this.planningSheet.readFile();
		const entry = data.find((ent) => {
			if (!ent?.entry) return false;
			const { entry } = ent;

			return format(entry.date, compareFormat) === format(absence.absenceDate, compareFormat);
		});
		if (!entry) return;
		const absents = new Set(entry.entry.absences.map((absence) => absence.discord.member.displayName));
		if (!absents.has(userDisplayName)) return;
		absents.delete(userDisplayName);
		const cell: Cell = { row: this.planningSheet.getLineIndexFor('absents') + 1, column: entry.col };
		const newValue = Array.from(absents).join(',');
		await this.googleService.editCell(this.fileId, await this.planningSheet.getSheetName(), cell, newValue);
	}
}
