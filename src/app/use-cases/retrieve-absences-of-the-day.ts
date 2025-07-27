import { Absence } from '../domain/entities/absence.entity';
import { AbsenceRepository } from '../domain/repositories/absence.repostiory';
import { config } from 'dotenv';
import { DiscordService } from '../domain/services/discord.service';

config();

export class RetrieveAbsencesOfTheDay {
	constructor(
		private readonly repo: AbsenceRepository,
		private discordService: DiscordService
	) {}

	async execute(date = new Date()): Promise<Absence[]> {
		date.setHours(0, 0, 0, 0);
		const absences = await this.repo.findByDateAndGuild(date, this.discordService.guildId);

		// Check same user, if same add messages and keep one absence
		const map = new Map<string, Absence>();
		absences.forEach((absence) => {
			if (!this.discordService.verifyGuild(absence.discord.guildId)) {
				return;
			}
			if (map.has(absence.discord.member.id)) {
				map.get(absence.discord.member.id)!.message += `\n${absence.message}`;
			} else {
				map.set(absence.discord.member.id, absence);
			}
		});
		const uniqueAbsences = map.values();

		return Array.from(uniqueAbsences);
	}
}
