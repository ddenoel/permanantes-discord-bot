import { Birthday, BirthdayDate } from '../../domain/entities/birthday.entity';
import { BirthdayRepository } from '../../domain/repositories/birthday.repository';
import { DiscordService } from '../../domain/services/discord.service';

export class UpdateBirthdayDate {
	constructor(
		private readonly repo: BirthdayRepository,
		private readonly discordService: DiscordService
	) {}

	async execute(birthday: Birthday, newDate: BirthdayDate): Promise<Birthday> {
		if (!this.discordService.verifyGuild(birthday.discordInfo.guildId)) return null;
		const updated = new Birthday({ ...birthday, birthdayDate: newDate });
		await this.repo.update(updated);
		return updated;
	}
}
