import { Collection } from 'fireorm';
import { IBirthdayEntity } from '../../../app/domain/entities/birthday.entity';

@Collection('birthday')
export class BirthdayModel implements IBirthdayEntity {
	id: string;
	birthdayDate: { month: number; day: number };
	member: { id: string; displayName?: string; username?: string };
	discordInfo: { guildId: string; createdByMember: { id: string; displayName?: string; username?: string } };
	createdAt: Date;
}


