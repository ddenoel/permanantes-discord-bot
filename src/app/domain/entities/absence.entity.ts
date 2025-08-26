export interface IDiscordInfo {
	guildId: string;
	member: {
		id: string;
		displayName?: string;
		username?: string;
	};
}

export interface IAbsenceEntity {
	id: string;
	discord: IDiscordInfo;
	absenceDate: Date;
	createdAt: Date;
	message?: string;
}

export class Absence implements IAbsenceEntity {
	id: string;
	discord: IDiscordInfo;
	absenceDate: Date;
	createdAt: Date;
	message?: string;

	constructor(absence: IAbsenceEntity) {
		this.id = absence.id;
		this.discord = absence.discord;
		this.absenceDate = absence.absenceDate;
		this.createdAt = absence.createdAt;
		this.message = absence.message;
	}
}
