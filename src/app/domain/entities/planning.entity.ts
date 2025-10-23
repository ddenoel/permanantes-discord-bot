import { IAbsenceEntity } from './absence.entity';

export type PlanningEventType = 'unknown' | 'rehearsal' | 'show' | 'workshop' | 'off';

export interface IPlanningDiscordInfo {
	guildId: string;
}

export interface IPlanningEntryEntity {
	id: string;
	date: Date;
	startDateTime?: Date;
	endDateTime?: Date;
	location: {
		name: string;
	};
	type: PlanningEventType;
	what: string;
	absences: IAbsenceEntity[];
	otherInfos?: string;
	lastSyncAt?: Date;
	lastSyncKey: string;
	discord: IPlanningDiscordInfo;
}

type PlanningEntryData = Omit<IPlanningEntryEntity, 'id' | 'lastSyncKey'> & Partial<IPlanningEntryEntity>;

export class PlanningEntry implements IPlanningEntryEntity {
	private _id: string;
	private _lastSyncKey: string;
	date: Date;
	startDateTime: Date;
	endDateTime: Date;
	location: {
		name: string;
	};
	type: PlanningEventType;
	what: string;
	absences: IAbsenceEntity[];
	otherInfos?: string;
	lastSyncAt?: Date;
	discord: IPlanningDiscordInfo;

	constructor(planningEntry: PlanningEntryData) {
		this.date = planningEntry.date;
		this.startDateTime = planningEntry.startDateTime;
		this.endDateTime = planningEntry.endDateTime;
		this.location = planningEntry.location;
		this.type = planningEntry.type;
		this.what = planningEntry.what;
		this.absences = planningEntry.absences;
		this.otherInfos = planningEntry.otherInfos;
		this.lastSyncAt = planningEntry.lastSyncAt;
		this.discord = planningEntry.discord;
	}

	static computeId(date: Date, guildId: string): string {
		const year = date.getFullYear();
		const month = `${date.getMonth() + 1}`.padStart(2, '0');
		const day = `${date.getDate()}`.padStart(2, '0');

		return `${year}-${month}-${day}-${guildId || 'unknown'}`;
	}

	get id(): string {
		return this._id ?? PlanningEntry.computeId(this.date, this.discord.guildId);
	}

	static computeSyncKey(date: Date, guildId: string): string {
		return this.computeId(date, guildId);
	}

	get lastSyncKey(): string {
		return this._lastSyncKey ?? PlanningEntry.computeSyncKey(this.lastSyncAt || new Date(), this.discord.guildId);
	}

	static getTodaySyncKey(guildId: string): string {
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		return this.computeSyncKey(now, guildId);
	}

	toInterface(): IPlanningEntryEntity {
		return {
			id: this.id,
			date: this.date,
			startDateTime: this.startDateTime,
			endDateTime: this.endDateTime,
			location: this.location,
			type: this.type,
			what: this.what,
			absences: this.absences,
			otherInfos: this.otherInfos,
			discord: this.discord,
			lastSyncAt: this.lastSyncAt ? new Date(this.lastSyncAt) : undefined,
			lastSyncKey: this.lastSyncKey,
		};
	}
}
