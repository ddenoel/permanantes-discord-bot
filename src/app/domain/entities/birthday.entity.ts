import { DiscordMember } from './discord-member.entity';

export interface BirthdayDate {
	month: number;
	day: number;
}

export interface IBirthdayDiscordInfo {
	guildId: string;
	createdByMember: DiscordMember;
}

export interface IBirthdayEntity {
	id: string;
	birthdayDate: BirthdayDate;
	member: DiscordMember;
	discordInfo: IBirthdayDiscordInfo;
	createdAt: Date;
}

export class Birthday implements IBirthdayEntity {
	id: string;
	birthdayDate: BirthdayDate;
	member: DiscordMember;
	discordInfo: IBirthdayDiscordInfo;
	createdAt: Date;

	constructor(data: IBirthdayEntity) {
		this.id = data.id;
		this.birthdayDate = data.birthdayDate;
		this.member = data.member;
		this.discordInfo = data.discordInfo;
		this.createdAt = data.createdAt;
	}
}
