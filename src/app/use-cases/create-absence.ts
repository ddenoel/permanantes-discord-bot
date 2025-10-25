import { Absence } from '../domain/entities/absence.entity';
import { AbsenceRepository } from '../domain/repositories/absence.repostiory';
import { createId } from '@paralleldrive/cuid2';
import { DiscordService } from '../domain/services/discord.service';
import { PlanningRepository } from '../domain/repositories/planning.repository';

export type CreateAbsencePayload = Pick<Absence, 'discord' | 'absenceDate' | 'message'>;

export class CreateAbsence {
	constructor(
		private readonly repo: AbsenceRepository,
		private readonly discordService: DiscordService,
		private readonly planningRepo: PlanningRepository
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

		// Link the created absence to the planning entry of the same date for this guild (if any)
		await this.planningRepo.addAbsence(input.absenceDate, input.discord.guildId, absence.id);

		return absence;
	}
}
