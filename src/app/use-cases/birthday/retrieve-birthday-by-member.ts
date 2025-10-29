import { Birthday } from '../../domain/entities/birthday.entity';
import { BirthdayRepository } from '../../domain/repositories/birthday.repository';
import { DiscordService } from '../../domain/services/discord.service';

export class RetrieveBirthdayByMember {
	constructor(
		private readonly repo: BirthdayRepository,
		private readonly discordService: DiscordService
	) {}

	async execute(memberId: string, guildId: string): Promise<Birthday | null> {
		if (!this.discordService.verifyGuild(guildId)) return null;
		return await this.repo.findByMemberAndGuild(memberId, guildId);
	}
}
