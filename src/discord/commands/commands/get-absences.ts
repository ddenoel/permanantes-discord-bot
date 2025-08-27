import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Command } from '../command.model';
import { App } from '../../../app';
import { Absence } from '../../../app/domain/entities/absence.entity';
import { validateAndParseDate } from './absence';
import { format, isToday } from 'date-fns';

const data = new SlashCommandBuilder();

data
	.setName('voir_absences')
	.setDescription("Voir les absences d'un jour donné (pas de date = aujourd'hui)")
	.addStringOption((option) => option.setName('date').setDescription('Date (format: JJ/MM/AAAA)').setRequired(false));

if (process.env.ENV_NAME === 'development') {
	data.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
}

const USER_ERROR_MESSAGE =
	"Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer ou contacter un administrateur si le problème persiste.";

export const command: Command = {
	data,
	async execute(interaction: ChatInputCommandInteraction) {
		if (!interaction.isCommand()) return;

		try {
			const dateStr = interaction.options.getString('date');

			let date: Date;
			if (!dateStr) {
				date = new Date();
			} else {
				try {
					date = validateAndParseDate(dateStr);
				} catch (error) {
					await interaction.reply({
						content: error instanceof Error ? error.message : USER_ERROR_MESSAGE,
						flags: MessageFlags.Ephemeral,
					});
					return;
				}
			}

			const app = new App(interaction.client);
			let absences: Absence[];
			try {
				absences = await app.retrieveAbsencesOfTheDay.execute(date);
			} catch (error) {
				console.error('[Voir Absences Command] Error retrieving absences:', error);
				await interaction.reply({
					content: USER_ERROR_MESSAGE,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			try {
				const MAX_NUMBER_OF_CHARS_MESSAGE = 60;
				const nb = absences.length;
				const formattedDate = isToday(date) ? "aujourd'hui" : `le **${format(date, 'dd/MM/yyyy')}**`;
				if (nb === 0) {
					await interaction.reply({
						content: '🎉 Aucune absence pour ' + formattedDate,
						flags: MessageFlags.Ephemeral,
					});
					return;
				}
				const message =
					`**${nb} absence${nb > 1 ? 's' : ''}** ${formattedDate}: \n` +
					absences
						.map((absence) => {
							return `- **<@${absence.discord.member.id}>** (${absence.message.replaceAll('\n', ',').slice(0, MAX_NUMBER_OF_CHARS_MESSAGE) + (absence.message.length > MAX_NUMBER_OF_CHARS_MESSAGE ? '...' : '')})`;
						})
						.join('\n');
				await interaction.reply({
					content: message,
					flags: MessageFlags.Ephemeral,
				});
			} catch (error) {
				console.error('[Voir Absences Command] Error warning absence:', error);
				await interaction.reply({
					content: USER_ERROR_MESSAGE,
					flags: MessageFlags.Ephemeral,
				});
			}
		} catch (error) {
			console.error('[Absence Command] Unexpected error:', {
				error,
				userId: interaction.user?.id,
				channelId: interaction.channelId,
				guildId: interaction.guildId,
			});
			await interaction.reply({
				content: USER_ERROR_MESSAGE,
				flags: MessageFlags.Ephemeral,
			});
		}
	},
};
