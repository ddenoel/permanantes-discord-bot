import { AbsenceRepository } from '../domain/repositories/absence.repostiory';
import { DiscordService } from '../domain/services/discord.service';
import { Absence } from '../domain/entities/absence.entity';

export class DeleteAbsence {
	constructor(
		private readonly repo: AbsenceRepository,
		private readonly discordService: DiscordService
	) {}

	async execute(absence: Absence, deleteMessage = true): Promise<void> {
		// validate date is today or future
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		if (absence.absenceDate.getTime() < today.getTime()) {
			throw new Error('Impossible de supprimer une absence passée.');
		}

		// delete discord message if stored
		if (deleteMessage && absence.discord?.messageId) {
			const channel: any = await this.discordService.getAbsenceChannel();
			const message = await channel.messages?.fetch(absence.discord.messageId).catch(() => null);
			if (message) {
				await message.delete().catch(() => null);
			}
		}

		// delete from repository
		await this.repo.delete(absence);
	}
}
