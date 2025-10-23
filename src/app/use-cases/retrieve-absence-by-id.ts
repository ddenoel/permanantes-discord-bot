import { Absence } from '../domain/entities/absence.entity';
import { AbsenceRepository } from '../domain/repositories/absence.repostiory';
import { DiscordService } from '../domain/services/discord.service';

export class RetrieveAbsenceById {
	constructor(
		private readonly repo: AbsenceRepository,
		private readonly discordService: DiscordService
	) {}

	async execute(absenceId: string): Promise<Absence | null> {
		const absence = await this.repo.findById(absenceId);
		if (!absence) return null;
		if (!this.discordService.verifyGuild(absence.discord.guildId)) return null;
		return absence as Absence;
	}
}
