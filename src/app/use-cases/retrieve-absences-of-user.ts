import { Absence } from '../domain/entities/absence.entity';
import { AbsenceRepository } from '../domain/repositories/absence.repostiory';
import { config } from 'dotenv';
import { DiscordService } from '../domain/services/discord.service';

config();

export class RetrieveAbsencesOfUser {
	constructor(
		private readonly repo: AbsenceRepository,
		private discordService: DiscordService
	) {}

	get defaultSince() {
		const now = new Date();
		const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
		const since = new Date(year, 8, 1);
		since.setHours(0, 0, 0, 0);

		return since;
	}

	async execute(userId: string, since?: Date): Promise<{ absences: Absence[]; since: Date }> {
		const from = since ?? this.defaultSince;
		const absences = await this.repo.findByUserAndGuildSince(userId, this.discordService.guildId, from);

		return {
			absences: absences.sort((a, b) => a.absenceDate.getTime() - b.absenceDate.getTime()),
			since: from,
		};
	}
}
