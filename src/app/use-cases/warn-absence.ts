import { Absence } from '../domain/entities/absence.entity';

import { config } from 'dotenv';
import { Client, TextChannel } from 'discord.js';
import { format } from 'date-fns';
import { DateUtils } from '../domain/utils/dates.utils';
import { DiscordService } from '../domain/services/discord.service';

config();

export class WarnAbsence {
	constructor(private discordService: DiscordService) {}

	async execute(absences: Absence[]) {
		if (!absences?.length) {
			return;
		}

		const absenceChannel = await this.discordService.getAbsenceChannel();

		if (!(absenceChannel instanceof TextChannel)) {
			throw new Error(`[Warn absence] Invalid channel type: Channel ${absenceChannel.id} is not a text channel`);
		}

		const notifyRoleId: string = process.env.NOTIFY_ROLE_ID || '';
		const roleTag = notifyRoleId ? `<@&${notifyRoleId}>` : '';

		const formattedDates = DateUtils.formatDateList(absences.map((a) => a.absenceDate));

		const absence = absences[0];

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
	}
}
