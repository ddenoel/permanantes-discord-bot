import { format, parse, setHours, setMinutes } from 'date-fns';
import { DateUtils } from '../../app/domain/utils/dates.utils';
import { Cell, GoogleService } from './google';
import { IGoogleSheetPlanningEntry, IGoogleSheetPlanningEntryEntity } from './model/planning.model';

export class PlanningSheet {
	private readonly fileId = process.env.GOOGLE_ABSENCES_FILE_ID;
	private readonly defaultSheetName = process.env.GOOGLE_ABSENCE_SHEET_NAME || 'Planning';
	private readonly sheetIndex = 0;
	private _sheetName: string | null = null;

	private rowMatcher: Record<keyof IGoogleSheetPlanningEntry, number | null> = {
		column: null,
		month: 0,
		date: 1,
		whereAndWhen: 2,
		what: 3,
		absents: 4,
		other: 5,
	};
	private indexRowMatcher = Object.fromEntries(
		Object.entries(this.rowMatcher).map(([key, value]) => [value, key])
	) as Record<number, keyof IGoogleSheetPlanningEntry>;

	constructor(private googleService: GoogleService) {
		this.getSheetName();
	}

	getLineIndexFor(prop: keyof IGoogleSheetPlanningEntry) {
		return this.rowMatcher[prop];
	}

	/**
	 * Gets the real name of the sheet (by index)
	 */
	async getSheetName(): Promise<string> {
		if (!this.fileId) {
			console.error('[GoogleSheetAbsenceRepository] GOOGLE_ABSENCES_FILE_ID is not defined');
			return this.defaultSheetName;
		}

		if (this._sheetName) {
			return this._sheetName;
		}

		const sheetName = await this.googleService.getSheetNameByIndex(this.fileId, this.sheetIndex);
		if (sheetName) {
			this._sheetName = sheetName;

			return sheetName;
		}

		return this.defaultSheetName;
	}

	async readFile(): Promise<{ col: string; entry: IGoogleSheetPlanningEntryEntity }[]> {
		if (!this.fileId) {
			console.error('[GoogleSheetAbsenceRepository] GOOGLE_ABSENCES_FILE_ID is not defined');
			return [];
		}

		const sheetName = await this.getSheetName();
		const rows = await this.googleService.readSheet(this.fileId, sheetName, 80, 10);

		const objs = [];
		rows.forEach((cols, index) => {
			const propName = this.indexRowMatcher[index];
			let prevValue = null;

			cols.forEach((col, colIndex) => {
				if (index === 0 && colIndex !== 0) {
					const obj: IGoogleSheetPlanningEntry = {
						column: GoogleService.parseIndexToColumn(colIndex + 1),
						month: null,
						date: null,
						whereAndWhen: null,
						what: null,
						absents: null,
						other: null,
					};
					objs.push(obj);
				}
				// Ignoring first column (headers)
				if (colIndex === 0) {
					return;
				}
				// As it can be merged
				if (!col && propName === 'month') {
					col = prevValue;
				}
				objs[colIndex - 1][propName] = col;
				prevValue = col;
			});
		});

		return Promise.all(objs.map(async (obj) => ({ col: obj.column, entry: await this.parseEntry(obj) })));
	}

	private async parseEntry(entry: IGoogleSheetPlanningEntry): Promise<IGoogleSheetPlanningEntryEntity> {
		const [, years] = (await this.getSheetName()).split(' ');
		const [year1, year2] = years.split('-');
		const fullYear1 = parseInt(`20${year1}`);
		const fullYear2 = parseInt(`20${year2}`);
		const month = DateUtils.getMonthNumberFromFrenchName(entry.month?.toLowerCase()?.trim());
		const day = parseInt(entry?.date?.match(/\d+/)[0]);

		const [when, where] = entry.whereAndWhen?.split('\n')?.map((whereAndWhen) => whereAndWhen?.trim()) || [];
		// Format 20h or 19h30 or 9h15
		const hours = when?.match(/(\d{1,2})h/)?.[1];
		const minutes = when?.match(/(\d{1,2})h/)?.[2];

		const year = month < 8 ? fullYear2 : fullYear1;

		const date = parse(`${day}-${month}-${year}`, 'dd-MM-yyyy', new Date());
		let startDateTime = hours ? setHours(date, parseInt(hours)) : null;
		if (minutes && startDateTime) {
			startDateTime = setMinutes(startDateTime, parseInt(minutes));
		}

		const absents = entry.absents
			.split(',')
			.map((name) => name.trim())
			.filter(Boolean);

		return {
			date,
			startDateTime,
			endDateTime: null,
			location: { name: where || 'unknown' },
			type: 'unknown',
			what: entry.what,
			absents,
			otherInfos: entry.other,
		};
	}
}
