import { IPlanningEntryEntity, PlanningProject } from '../domain/entities/planning.entity';
import { PlanningRepository } from '../domain/repositories/planning.repository';
import { DiscordService } from '../domain/services/discord.service';

export class RetrieveFuturePlanningEntries {
	constructor(
		private readonly planningRepo: PlanningRepository,
		private readonly discordService: DiscordService
	) {}

	async execute(project?: PlanningProject): Promise<IPlanningEntryEntity[]> {
		project ??= 'atelier';
		const guildId = this.discordService.guildId;
		return this.planningRepo.findAllFuture(guildId, project);
	}
}
