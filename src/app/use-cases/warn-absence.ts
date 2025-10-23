import { Absence } from '../domain/entities/absence.entity';

import { config } from 'dotenv';
import { TextChannel } from 'discord.js';
import { format } from 'date-fns';
import { DateUtils } from '../domain/utils/dates.utils';
import { DiscordService } from '../domain/services/discord.service';
import { AbsenceRepository } from '../domain/repositories/absence.repostiory';

config();

export class WarnAbsence {
	constructor(
		private discordService: DiscordService,
		private readonly repo?: AbsenceRepository
	) {}

	async execute(absences: Absence[]) {
		if (!absences?.length) {
			return;
		}

		const todayAbsences = absences.filter((absence) => DateUtils.isSameDay(absence.absenceDate, new Date()));

		if (todayAbsences.length === 0) {
			return;
		}

		const absenceChannel = await this.discordService.getAbsenceChannel();

		if (!(absenceChannel instanceof TextChannel)) {
			throw new Error(`[Warn absence] Invalid channel type: Channel ${absenceChannel.id} is not a text channel`);
		}

		const notifyRoleId: string = process.env.NOTIFY_ROLE_ID || '';
		const roleTag = notifyRoleId ? `<@&${notifyRoleId}>` : '';

		const formattedDates = DateUtils.formatDateList(todayAbsences.map((a) => a.absenceDate));

		const absence = todayAbsences[0];

		const message = await absenceChannel
			.send(
				`Oh non ! <@${absence.discord.member.id}> ne sera pas parmi nous ${formattedDates} 😭 ${roleTag}\n --- \nVoici son petit mot :\n> ${absence.message}`
			)
			.catch(async (error) => {
				console.error('[Warn absence] Failed to send message:', {
					error,
					channelId: absenceChannel.id,
					userId: absence.discord.member.id,
				});
				throw new Error('[Warn absence] Failed to send message');
			});

		if (!message) return;

		const threadDate = format(absence.absenceDate, 'dd/MM/yyyy');

		await message
			.startThread({
				name: `${threadDate} - Absence de ${absence.discord.member.displayName || ''}`,
				autoArchiveDuration: 4320, // 3 days
			})
			.catch(async (error) => {
				console.error('[Warn absence] Failed to create thread:', {
					error,
					messageId: message.id,
					channelId: absenceChannel.id,
					userId: absence.discord.member.id,
				});
			});

		if (this.repo) {
			try {
				await this.repo.setDiscordMessageId(absence.id, message.id);
			} catch (e) {
				console.error('[Warn absence] Failed to persist discord message id', {
					absenceId: absence.id,
					messageId: message.id,
					error: e,
				});
			}
		}
	}
}
