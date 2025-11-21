import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Command } from '../command.model';
import { verifyRole } from '../shared/verify-role';
import { App } from '../../../app';
import { DateUtils } from '../../../app/domain/utils/dates.utils';

const data = new SlashCommandBuilder();

data
	.setName('synchroniser_planning')
	.setDescription('Forcer la synchronisation du planning depuis Google Sheets')
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const USER_ERROR_MESSAGE =
	"Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer ou contacter un administrateur si le problème persiste.";

export const command: Command = {
	data,
	async execute(interaction: ChatInputCommandInteraction) {
		if (!interaction.isCommand()) return;

		try {
			if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
				await interaction.reply({
					content: "Vous n'avez pas les permissions nécessaires pour utiliser cette commande (Administrateur).",
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const app = new App(interaction.client);

			let lines: string[] = ['🧹 Préparation...'];
			await interaction.reply({
				content: lines.join('\n'),
				flags: MessageFlags.Ephemeral,
			});

			let progressLineIndex = -1;
			const result = await app.syncPlanning.execute(interaction.guildId, true, true, async (evt) => {
				switch (evt.stage) {
					case 'reading_file':
						lines.push(evt.message);
						break;
					case 'entries_found':
						lines.push(evt.message);
						break;
					case 'sync_progress':
						const progressText = evt.message;
						if (progressLineIndex >= 0) {
							lines[progressLineIndex] = progressText;
						} else {
							lines.push(progressText);
							progressLineIndex = lines.length - 1;
						}
						break;
					case 'done':
						lines.push(evt.message);
						break;
					case 'error':
						lines.push(evt.message);
						break;
				}
				await interaction.editReply({ content: lines.join('\n') });
			});

			const fmtDates = (dates: Date[]) =>
				dates.length ? dates.map((d) => `• ${DateUtils.formatDate(d)}`).join('\n') : '—';

			const details = (result as any).details || {
				created: [],
				modified: [],
				identical: 0,
				deleted: [],
				errors: [],
			};
			let summary = `### Récapitulatif de la synchronisation\n`;
			const getPlural = (count: number) => (count === 1 ? '' : 's');
			const deletedPlural = getPlural(details.deleted.length);
			const createdPlural = getPlural(details.created.length);
			const modifiedPlural = getPlural(details.modified.length);
			const identicalPlural = getPlural(details.identical);
			const errorsPlural = getPlural(details.errors.length);
			summary +=
				`\n- Date${deletedPlural} supprimée${deletedPlural}: **${details.deleted.length}**` +
				`${details.deleted.length ? `\n${fmtDates(details.deleted)}` : ''}`;
			summary +=
				`\n- Date${createdPlural} créée${createdPlural}: **${details.created.length}**` +
				`${details.created.length ? `\n${fmtDates(details.created)}` : ''}`;
			summary +=
				`\n- Date${modifiedPlural} modifiée${modifiedPlural}: **${details.modified.length}**` +
				`${details.modified.length ? `\n${fmtDates(details.modified)}` : ''}`;
			summary += `\n- Date${identicalPlural} identique${identicalPlural}: **${details.identical}**`;
			summary +=
				`\n- Date${errorsPlural} en erreur: **${details.errors.length}**` +
				`${details.errors.length ? `\n${fmtDates(details.errors)}` : ''}`;

			lines.push('', summary);
			await interaction.editReply({ content: lines.join('\n') });
		} catch (error) {
			console.error('[Sync Planning Command] Unexpected error:', {
				error,
				userId: interaction.user?.id,
				channelId: interaction.channelId,
				guildId: interaction.guildId,
			});
			if (interaction.deferred || interaction.replied) {
				await interaction.editReply({ content: USER_ERROR_MESSAGE });
			} else {
				await interaction.reply({ content: USER_ERROR_MESSAGE, flags: MessageFlags.Ephemeral });
			}
		}
	},
};
