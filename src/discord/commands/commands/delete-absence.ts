import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	MessageFlags,
	PermissionFlagsBits,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	Interaction,
} from 'discord.js';
import { Command } from '../command.model';
import { App } from '../../../app';
import { startOfDay } from 'date-fns';
import { DateUtils } from '../../../app/domain/utils/dates.utils';

const data = new SlashCommandBuilder();

data.setName('supprimer_absence').setDescription("Supprimer une absence (aujourd'hui ou future)");

if (process.env.ENV_NAME === 'development') {
	data.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
}

const USER_ERROR_MESSAGE =
	"Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer ou contacter un administrateur si le problème persiste.";

const SELECT_ID = 'delete_absence_select';

export const command: Command = {
	data,
	async execute(interaction: ChatInputCommandInteraction) {
		if (!interaction.isCommand()) return;

		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const app = new App(interaction.client);
			const userId = interaction.user.id;
			const { absences } = await app.retrieveAbsencesOfUser.execute(userId);
			const today = startOfDay(new Date());

			const selectable = absences
				.map((a) => ({ ...a, date: startOfDay(a.absenceDate) }))
				.filter(({ date }) => date.getTime() >= today.getTime())
				.sort((a, b) => a.date.getTime() - b.date.getTime());

			if (!selectable.length) {
				await interaction.editReply({ content: 'Aucune absence supprimable.' });
				return;
			}

			const MAX_NUMBER_OF_CHARS_MESSAGE = 30;

			const trimMessage = (message: string) => {
				try {
					if (!message) return '';
					if (message.length <= MAX_NUMBER_OF_CHARS_MESSAGE) return message;

					return (
						message.slice(0, MAX_NUMBER_OF_CHARS_MESSAGE) + (message.length > MAX_NUMBER_OF_CHARS_MESSAGE ? '...' : '')
					);
				} catch (error) {
					console.error('[Trim Message] Error:', error);
					return '';
				}
			};

			const menu = new StringSelectMenuBuilder()
				.setCustomId(SELECT_ID)
				.setPlaceholder('Choisissez une absence à supprimer')
				.addOptions(
					selectable.map(({ id, date, message }) => {
						const desc = trimMessage(message);
						const option = new StringSelectMenuOptionBuilder().setLabel(`${DateUtils.formatDate(date)}`).setValue(id);
						option.setDescription(desc && desc.length > 0 ? desc : '\u200B');
						return option;
					})
				);

			const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

			await interaction.editReply({ content: 'Sélectionnez une absence à supprimer :', components: [row] });
		} catch (error) {
			console.error('[Supprimer Absence Command] Unexpected error:', error);
			try {
				if (interaction.deferred) {
					await interaction.editReply({ content: USER_ERROR_MESSAGE });
				} else if (interaction.replied) {
					await interaction.followUp({ content: USER_ERROR_MESSAGE, flags: MessageFlags.Ephemeral });
				} else {
					await interaction.reply({ content: USER_ERROR_MESSAGE, flags: MessageFlags.Ephemeral });
				}
			} catch (e) {
				console.error('[Supprimer Absence Command] Failed to send error reply:', e);
			}
		}
	},
	handleCommandInteractions: async (interaction: Interaction) => {
		if (interaction.isStringSelectMenu() && interaction.customId === SELECT_ID) {
			try {
				const absenceId = interaction.values?.[0];
				if (!absenceId) {
					await interaction.reply({ content: 'Sélection invalide.', flags: MessageFlags.Ephemeral });
					return;
				}

				const app = new App(interaction.client);
				const absence = await app.retrieveAbsenceById.execute(absenceId);
				if (!absence) {
					await interaction.reply({ content: 'Absence introuvable.', flags: MessageFlags.Ephemeral });
					return;
				}

				await app.deleteAbsence.execute(absence);
				await interaction.update({ content: 'Absence supprimée ✅ \n \n-# Allez, ça dégage ! 🗑️', components: [] });
			} catch (error) {
				console.error('[Delete Absence Select] Error:', error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ content: 'Erreur lors de la suppression.', flags: MessageFlags.Ephemeral });
				} else {
					await interaction.reply({ content: 'Erreur lors de la suppression.', flags: MessageFlags.Ephemeral });
				}
			}
		}
	},
};
