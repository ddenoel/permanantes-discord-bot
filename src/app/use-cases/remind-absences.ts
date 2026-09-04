import { Absence, IDiscordInfo } from '../domain/entities/absence.entity';

import { config } from 'dotenv';
import { TextChannel } from 'discord.js';
import { DateUtils } from '../domain/utils/dates.utils';
import { fr } from 'date-fns/locale';
import { format } from 'date-fns';
import { DiscordService } from '../domain/services/discord.service';

config();

export type RemindAbsencesPayload = Pick<Absence, 'absenceDate' | 'message'> & {
	discord: Pick<IDiscordInfo, 'guildId'> & {
		member: Pick<IDiscordInfo['member'], 'id'>;
	};
};

export class RemindAbsences {
	constructor(private discordService: DiscordService) {}

	async execute(absences: RemindAbsencesPayload[]) {
		if (!absences?.length) {
			return;
		}

		const channel = await this.discordService.getAbsenceChannel();

		const notifyRoleId = (await this.discordService.getConfig()).discord.absence.roleToNotifyId;
		const roleTag = notifyRoleId ? `<@&${notifyRoleId}>` : '';

		if (!(channel instanceof TextChannel)) {
			console.error('[Remind Absences] Invalid channel type:', channel.id);
			return;
		}

		const baseDate = absences[0].absenceDate;
		let formattedDate = `le ${format(baseDate, 'dd MMMM yyyy', { locale: fr })}`;
		if (DateUtils.isSameDay(absences[0].absenceDate, new Date())) {
			formattedDate = `aujourd'hui`;
		}

		let message = `**Rappel** ${roleTag} \n`;
		if (absences.length === 1) {
			const absence = absences[0];
			message += `<@${absence.discord.member.id}> n'est pas parmis nous ${formattedDate} ! 😢 \n`;
			message += `> ${absence.message.split('\n').join('\n> ')}`;
		} else {
			message += `**${absences.length} personnes** ne seront pas parmis nous ${formattedDate} ! 😢 \n`;
			const formatted = absences.map((absence) => `<@${absence.discord.member.id}>`);
			const last = formatted.pop();
			message += formatted.join(', ') + ` et ${last}`;
			message += ' vous allez nous manquer !';
			message += '\n --- \n';
			absences.forEach((absence) => {
				message += `<@${absence.discord.member.id}> \n`;
				message += `> ${absence.message.split('\n').join('\n> ')} \n`;
			});
		}

		await channel.send(message);
	}
}
