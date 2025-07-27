import { Absence } from '../domain/entities/absence.entity';
import { AbsenceRepository } from '../domain/repositories/absence.repostiory';
import { createId } from '@paralleldrive/cuid2';
import { DiscordService } from '../domain/services/discord.service';

export type CreateAbsencePayload = Pick<Absence, 'discord' | 'absenceDate' | 'message'>;

export class CreateAbsence {
	constructor(
		private readonly repo: AbsenceRepository,
		private readonly discordService: DiscordService
	) {}

	async execute(input: CreateAbsencePayload): Promise<Absence> {
		if (!this.discordService.verifyGuild(input.discord.guildId)) {
			return null;
		}

		input.absenceDate.setHours(0, 0, 0, 0);

		const absence = new Absence({
			id: createId(),
			discord: input.discord,
			absenceDate: input.absenceDate,
			createdAt: new Date(),
			message: input.message,
		});
		await this.repo.save(absence);

		return absence;
	}
}
