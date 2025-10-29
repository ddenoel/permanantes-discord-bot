import { Birthday } from '../../domain/entities/birthday.entity';

export interface BirthdayRepository {
	save(birthday: Birthday): Promise<void>;
	findByMemberAndGuild(memberId: string, guildId: string): Promise<Birthday | null>;
	update(birthday: Birthday): Promise<void>;
	findByDayAndGuild(month: number, day: number, guildId: string): Promise<Birthday[]>;
}


