import { format } from 'date-fns';
import { Absence } from '../../app/domain/entities/absence.entity';
import { AbsenceRepository } from '../../app/domain/repositories/absence.repostiory';
import { GoogleService } from './google';
import { fr } from 'date-fns/locale';
import { config } from 'dotenv';

config();

export class GoogleSheetAbsenceRepository implements AbsenceRepository {
	private readonly fileId = process.env.GOOGLE_ABSENCES_FILE_ID;
	private readonly sheetName = process.env.GOOGLE_ABSENCES_SHEET_NAME || 'Planning';
	private readonly absencesLine = parseInt(process.env.GOOGLE_ABSENCES_ABSENTS_LINE, 10) || 6;
	private readonly dateLine = parseInt(process.env.GOOGLE_ABSENCES_DATE_LINE, 10) || 2;
	private DATE_LINE_FORMAT = 'dd/MM/yyyy';

	constructor(private googleService: GoogleService) {}

	async findByDateAndGuild(date: Date, guildId: string): Promise<Absence[]> {
		if (!this.fileId) {
			console.error('[GoogleSheetAbsenceRepository] GOOGLE_ABSENCES_FILE_ID is not defined');
			return [];
		}

		const col = await this.findAbsenceCellForDate(date);
		if (!col) {
			return [];
		}

		const cell = { row: this.absencesLine, column: col };
		const currValue = await this.googleService.getCellValue(this.fileId, this.sheetName, cell);
		if (!currValue) {
			return [];
		}

		const absents = currValue.split(', ');
		return absents.map(
			(absent) =>
				new Absence({
					absenceDate: date,
					createdAt: new Date(),
					discord: { member: { displayName: absent, id: null }, guildId },
					id: null,
				})
		);
	}

	async save(absence: Absence): Promise<void> {
		if (!this.fileId) {
			console.error('[GoogleSheetAbsenceRepository] GOOGLE_ABSENCES_FILE_ID is not defined');
			return;
		}

		const col = await this.findAbsenceCellForDate(absence.absenceDate);
		if (!col) {
			return;
		}

		const cell = { row: this.absencesLine, column: col };
		const currValue = await this.googleService.getCellValue(this.fileId, this.sheetName, cell);
		const values = new Set(currValue ? currValue.split(', ') : []);
		const userName = absence.discord.member.displayName;
		if (values.has(userName)) {
			return;
		}
		values.add(userName);
		const newValue = Array.from(values).join(', ');
		await this.googleService.editCell(this.fileId, this.sheetName, cell, newValue);

		return;
	}

	private async findAbsenceCellForDate(date: Date) {
		const formattedDate = format(date, this.DATE_LINE_FORMAT, { locale: fr });
		const col = await this.googleService.findColumnByRowValue(
			this.fileId,
			this.sheetName,
			this.dateLine,
			formattedDate
		);

		if (!col) {
			console.warn(`[GoogleSheetAbsenceRepository] Date ${formattedDate} not found in sheet`);

			return null;
		}

		return col;
	}
}
