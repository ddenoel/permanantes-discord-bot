import { parse, setHours, setMinutes } from 'date-fns';
import { DateUtils } from '../../app/domain/utils/dates.utils';
import { GoogleService } from './google';
import {
	GoogleSheetSeanceType,
	IGoogleSheetPlanningEntry,
	IGoogleSheetPlanningEntryEntity,
} from './model/planning.model';
import { ActivityType, IPlanningEntryEntity, PlanningEntry } from '../../app/domain/entities/planning.entity';
import { PermanantesConfigService } from '../../app/domain/services/permanantes-config.service';

export class PlanningSheet {
	private readonly sheetIndex = 0;

	private rowMatcher: Record<keyof IGoogleSheetPlanningEntry, number | null> = {
		column: null,
		month: 0,
		date: 1,
		dateFull: 2,
		whereAndWhen: 3,
		what: 4,
		absents: 5,
		other: 6,
		project: 7,
		seanceType: 8,
	};
	private indexRowMatcher = Object.fromEntries(
		Object.entries(this.rowMatcher).map(([key, value]) => [value, key])
	) as Record<number, keyof IGoogleSheetPlanningEntry>;

	constructor(
		private googleService: GoogleService,
		private configService: PermanantesConfigService
	) {}

	private get guildId() {
		return process.env.GUILD_ID;
	}

	async getFileId(): Promise<string | null> {
		const config = await this.configService.get(this.guildId);
		return config.planning.googleSheetId || null;
	}

	async getFileName(): Promise<string> {
		const fileId = await this.getFileId();
		return this.googleService.getFileName(fileId);
	}

	getLineIndexFor(prop: keyof IGoogleSheetPlanningEntry) {
		return this.rowMatcher[prop];
	}

	private seanceTypeToActivityType(seanceType: GoogleSheetSeanceType): ActivityType {
		if (!seanceType) return 'unknown';
		switch (seanceType) {
			case 'Théâtre':
				return 'theater';
			case 'Chant':
				return 'singing';
			case 'Danse / Mise en corps':
				return 'dance';
			case 'Répétition générale':
				return 'general_rehearsal';
			case 'A définir':
				return 'to_be_defined';
			case 'Autre':
				return 'other';
			default:
				console.error('[PlanningSheet] Unknown seance type:', seanceType);
				return 'unknown';
		}
	}

	toDomain(entry: IGoogleSheetPlanningEntryEntity): IPlanningEntryEntity {
		const guildId = process.env.GUILD_ID;

		return new PlanningEntry({
			...entry,
			lastSyncAt: null,
			lastSyncKey: null,
			absences: entry.absents.map((absent) => ({
				id: null,
				discord: { member: { displayName: absent, id: null }, guildId },
				absenceDate: entry.date,
				createdAt: new Date(),
			})),
			discord: { guildId },
			project: PlanningEntry.parseProject(entry.project),
			// TODO: actually in the sheet we can have multiple values for the seance type, we need to handle this
			seanceType: this.seanceTypeToActivityType(entry.seanceType),
		});
	}

	/**
	 * Gets the sheet name from config, falling back to the sheet at index 0
	 */
	async getSheetName(): Promise<string> {
		const config = await this.configService.get(this.guildId);
		if (config.planning.sheetName) {
			return config.planning.sheetName;
		}

		const fileId = await this.getFileId();
		if (!fileId) {
			console.error('[PlanningSheet] planning.googleSheetId is not defined in Permanantes config');
			return 'Planning';
		}

		const sheetName = await this.googleService.getSheetNameByIndex(fileId, this.sheetIndex);
		if (sheetName) {
			return sheetName;
		}

		return 'Planning';
	}

	async readFile(): Promise<{ col: string; entry: IPlanningEntryEntity }[]> {
		const fileId = await this.getFileId();
		if (!fileId) {
			console.error('[PlanningSheet] planning.googleSheetId is not defined in Permanantes config');
			return [];
		}

		const sheetName = await this.getSheetName();
		const rows = await this.googleService.readSheet(fileId, sheetName, 80, 10);

		const objs = [];
		rows.forEach((cols, index) => {
			const propName = this.indexRowMatcher[index];
			let prevValue = null;

			cols.forEach((col, colIndex) => {
				// Ensure an object exists for the current column (some rows may have more columns than the first row)
				if (colIndex !== 0 && !objs[colIndex - 1]) {
					const obj: IGoogleSheetPlanningEntry = {
						column: GoogleService.parseIndexToColumn(colIndex + 1),
						month: null,
						date: null,
						dateFull: null,
						whereAndWhen: null,
						what: null,
						absents: null,
						other: null,
						project: 'other',
						seanceType: null,
					};
					objs[colIndex - 1] = obj;
				}
				// Ignoring first column (headers)
				if (colIndex === 0) {
					return;
				}
				// As it can be merged
				if (!col && propName === 'month') {
					col = prevValue;
				}
				// Skip rows we don't know how to map
				if (!propName) {
					return;
				}
				objs[colIndex - 1][propName] = col;
				prevValue = col;
			});
		});

		return Promise.all(
			objs
				.map(async (obj) => {
					const entry = await this.parseEntry(obj);
					if (!entry) {
						return null;
					}
					return { col: obj.column, entry: this.toDomain(entry) };
				})
				.filter(Boolean)
		);
	}

	private async oldRetrieveDate(entry: IGoogleSheetPlanningEntry): Promise<Date> {
		const [, years] = (await this.getSheetName()).split(' ');
		const [year1, year2] = years.split('-');
		const fullYear1 = parseInt(`20${year1}`);
		const fullYear2 = parseInt(`20${year2}`);
		const month = DateUtils.getMonthNumberFromFrenchName(entry.month?.toLowerCase()?.trim());
		const day = parseInt(entry?.date?.match(/\d+/)[0]);

		const year = month < 8 ? fullYear2 : fullYear1;

		const date = parse(`${day}-${month}-${year}`, 'dd-MM-yyyy', new Date());

		return date;
	}

	private async parseEntry(entry: IGoogleSheetPlanningEntry): Promise<IGoogleSheetPlanningEntryEntity> {
		if (!entry?.dateFull) {
			return null;
		}

		const dateFull = entry?.dateFull;
		let date: Date;
		try {
			if (dateFull) {
				const dateString = dateFull.split(' ')?.[1];
				date = parse(dateString, 'dd/MM/yyyy', new Date());
			} else {
				date = await this.oldRetrieveDate(entry);
			}
		} catch (error) {
			console.error('[PlanningSheet] Error parsing Google sheet entry:', error, entry);
			return null;
		}

		const [when, where] = entry?.whereAndWhen?.split('\n')?.map((whereAndWhen) => whereAndWhen?.trim()) || [];
		// Format examples: 20h, 19h30, 9h15
		const timeMatch = when?.match(/^(\d{1,2})h(?:(\d{2}))?$/);
		const hours = timeMatch?.[1] || '20';
		const minutes = timeMatch?.[2] || '00';

		let startDateTime = hours ? setHours(date, parseInt(hours)) : null;
		if (minutes && startDateTime) {
			startDateTime = setMinutes(startDateTime, parseInt(minutes));
		}

		const absents = entry?.absents
			? entry.absents
					.split(',')
					.map((name) => name.trim())
					.filter(Boolean)
			: [];

		return {
			date,
			startDateTime,
			endDateTime: null,
			location: { name: where || 'unknown' },
			type: 'unknown',
			what: entry.what,
			absents,
			otherInfos: entry.other,
			project: PlanningEntry.parseProject(entry.project),
			seanceType: entry.seanceType,
		};
	}
}
