import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	MessageFlags,
	PermissionFlagsBits,
	Interaction,
} from 'discord.js';
import { Command } from '../command.model';
import { App } from '../../../app';
import { verifyRole } from './shared/verify-role';
import { getPlanningEntriesAsSelect } from './shared/get-planning-entries-as-select';

const data = new SlashCommandBuilder();

data.setName('voir_absences').setDescription("Voir les absences d'un jour donné");

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
			const roleOk = await verifyRole(interaction);
			if (!roleOk) return;

			const app = new App(interaction.client);

			// Affiche un sélecteur des prochaines dates (sans disabled)
			try {
				const planningEntries = await app.retrieveFuturePlanningEntries.execute();
				const { components, handleInteraction } = getPlanningEntriesAsSelect(interaction, planningEntries, {
					customIds: { select: SELECT_ID, prev: PREV_ID, next: NEXT_ID },
					pageIndex: 0,
					pageSize: 25,
				});
				paginationHandlerByUser.set(interaction.user.id, handleInteraction);
				await interaction.reply({
					content: '📅 Choisissez une date pour voir les absences',
					components,
					flags: MessageFlags.Ephemeral,
				});
				// Note: the select handling (to fetch absences per date) can be wired similarly to other commands
			} catch (error) {
				console.error('[Voir Absences Command] Error building planning select:', error);
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
	handleCommandInteractions: async (interaction: Interaction) => {
		// Pagination prev/next
		if (interaction.isButton() && (interaction.customId === NEXT_ID || interaction.customId === PREV_ID)) {
			const handler = paginationHandlerByUser.get(interaction.user.id);
			if (handler) await handler(interaction);
			return;
		}

		// Selection of a date
		if (interaction.isStringSelectMenu() && interaction.customId === SELECT_ID) {
			try {
				const iso = interaction.values?.[0];
				if (!iso || iso === 'none') {
					await interaction.reply({ content: 'Sélection invalide.', flags: MessageFlags.Ephemeral });
					return;
				}
				const date = new Date(iso);
				const app = new App(interaction.client);
				const absences = await app.retrieveAbsencesOfTheDay.execute(date);

				const MAX_CHARS = 60;
				const nb = absences.length;
				const header = `📅 Absences pour le **${date.toLocaleDateString('fr-FR')}**`;
				const content = (
					nb === 0
						? `${header}\n\n🎉 Aucune absence`
						: `${header}\n\n**${nb} absence${nb > 1 ? 's' : ''}**:\n` +
							absences
								.map(
									(a) =>
										`- **<@${a.discord.member.id}>** (${(a.message || '')
											.replaceAll('\n', ',')
											.slice(0, MAX_CHARS)}${(a.message || '').length > MAX_CHARS ? '...' : ''})`
								)
								.join('\n`')
				) as string;

				await interaction.update({ content, components: interaction.message.components });
			} catch (error) {
				console.error('[Voir Absences Command] Select error:', error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({
						content: 'Erreur lors du chargement des absences.',
						flags: MessageFlags.Ephemeral,
					});
				} else {
					await interaction.reply({
						content: 'Erreur lors du chargement des absences.',
						flags: MessageFlags.Ephemeral,
					});
				}
			}
		}
	},
};

const SELECT_ID = 'get_absences_select';
const PREV_ID = 'get_absences_prev';
const NEXT_ID = 'get_absences_next';
const paginationHandlerByUser = new Map<string, (i: Interaction) => Promise<void>>();
