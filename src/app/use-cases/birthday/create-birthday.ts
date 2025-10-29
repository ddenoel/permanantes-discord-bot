import { createId } from '@paralleldrive/cuid2';
import { Birthday } from '../../domain/entities/birthday.entity';
import { BirthdayRepository } from '../../domain/repositories/birthday.repository';
import { DiscordService } from '../../domain/services/discord.service';

export type CreateBirthdayPayload = Pick<Birthday, 'birthdayDate' | 'member' | 'discordInfo'>;

export class CreateBirthday {
	constructor(
		private readonly repo: BirthdayRepository,
		private readonly discordService: DiscordService
	) {}

	async execute(input: CreateBirthdayPayload): Promise<Birthday> {
		if (!this.discordService.verifyGuild(input.discordInfo.guildId)) {
			return null;
		}

		const birthday = new Birthday({
			id: createId(),
			birthdayDate: input.birthdayDate,
			member: input.member,
			discordInfo: input.discordInfo,
			createdAt: new Date(),
		});

		await this.repo.save(birthday);
		return birthday;
	}
}
