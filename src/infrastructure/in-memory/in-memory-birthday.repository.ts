import { Birthday } from '../../app/domain/entities/birthday.entity';
import { BirthdayRepository } from '../../app/domain/repositories/birthday.repository';

const birthdays: Birthday[] = [];

export class InMemoryBirthdayRepository implements BirthdayRepository {
	async save(birthday: Birthday): Promise<void> {
		birthdays.push(birthday);
	}

	async findByMemberAndGuild(memberId: string, guildId: string): Promise<Birthday | null> {
		const found = birthdays.find((b) => b.member.id === memberId && b.discordInfo.guildId === guildId);
		return found || null;
	}

	async update(birthday: Birthday): Promise<void> {
		const idx = birthdays.findIndex((b) => b.id === birthday.id);
		if (idx !== -1) birthdays[idx] = birthday;
	}

	async findByDayAndGuild(month: number, day: number, guildId: string): Promise<Birthday[]> {
		return birthdays.filter(
			(b) => b.discordInfo.guildId === guildId && b.birthdayDate.month === month && b.birthdayDate.day === day
		);
	}
}
