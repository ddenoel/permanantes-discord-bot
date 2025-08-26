import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Command } from '../command.model';
import { App } from '../../../app';
import { Absence } from '../../../app/domain/entities/absence.entity';
import { validateAndParseDate } from './absence';

const data = new SlashCommandBuilder();

data
	.setName('voir_absences')
	.setDescription("Voir les absences d'un jour donné")
	.addStringOption((option) => option.setName('date').setDescription('Date (format: JJ/MM/AAAA)').setRequired(false));

if (process.env.ENV_NAME === 'development') {
	data.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
}

const USER_ERROR_MESSAGE =
	"Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer ou contacter un administrateur si le problème persiste.";

// Helper function to safely reply to an interaction
async function safeReply(interaction: ChatInputCommandInteraction, content: string, ephemeral = true) {
	if (!interaction.isRepliable()) return false;

	try {
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({
				content,
				flags: ephemeral ? MessageFlags.Ephemeral : undefined,
			});
		} else {
			await interaction.reply({
				content,
				flags: ephemeral ? MessageFlags.Ephemeral : undefined,
			});
		}
		return true;
	} catch (error) {
		console.error('[Absence Command] Failed to send reply:', error);
		return false;
	}
}

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
					await safeReply(interaction, error instanceof Error ? error.message : USER_ERROR_MESSAGE);
					return;
				}
			}

			const app = new App(interaction.client);
			let absences: Absence[];
			try {
				absences = await app.retrieveAbsencesOfTheDay.execute(date);
			} catch (error) {
				console.error('[Voir Absences Command] Error retrieving absences:', error);
				await safeReply(interaction, USER_ERROR_MESSAGE);
				return;
			}

			try {
				const MAX_NUMBER_OF_CHARS_MESSAGE = 60;
				const nb = absences.length;
				if (nb === 0) {
					await safeReply(interaction, '🎉 Aucune absence pour le jour **' + dateStr + '**');
					return;
				}
				const message =
					`**${nb} absence${nb > 1 ? 's' : ''}** le **${dateStr}**: \n` +
					absences
						.map((absence) => {
							return `- **<@${absence.discord.member.id}>** (${absence.message.replace('\n', ',').slice(0, MAX_NUMBER_OF_CHARS_MESSAGE) + (absence.message.length > MAX_NUMBER_OF_CHARS_MESSAGE ? '...' : '')})`;
						})
						.join('\n');
				await safeReply(interaction, message);
			} catch (error) {
				console.error('[Voir Absences Command] Error warning absence:', error);
				await safeReply(interaction, USER_ERROR_MESSAGE);
			}
		} catch (error) {
			console.error('[Absence Command] Unexpected error:', {
				error,
				userId: interaction.user?.id,
				channelId: interaction.channelId,
				guildId: interaction.guildId,
			});
			await safeReply(interaction, USER_ERROR_MESSAGE);
		}
	},
};
