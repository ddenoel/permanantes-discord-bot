import { IPlanningEntryEntity } from '../domain/entities/planning.entity';
import { PlanningRepository } from '../domain/repositories/planning.repository';
import { DiscordService } from '../domain/services/discord.service';

export class RetrieveFuturePlanningEntries {
	constructor(
		private readonly planningRepo: PlanningRepository,
		private readonly discordService: DiscordService
	) {}

	async execute(fromDate?: Date): Promise<IPlanningEntryEntity[]> {
		const guildId = this.discordService.guildId;
		return this.planningRepo.findAllFuture(guildId, fromDate);
	}
}
