import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Command } from '../command.model';
import { App } from '../../../app';
import { format } from 'date-fns';
import { Absence } from '../../../app/domain/entities/absence.entity';

const data = new SlashCommandBuilder();

data.setName('voir_mes_absences').setDescription('Lister vos absences');

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
			const app = new App(interaction.client);
			const userId = interaction.user.id;
			let absences: Absence[];
			let since: Date;
			try {
				const data = await app.retrieveAbsencesOfUser.execute(userId);
				absences = data.absences;
				since = data.since;
			} catch (error) {
				console.error('[Voir Mes Absences Command] Error retrieving absences:', error);
				await interaction.reply({ content: USER_ERROR_MESSAGE, flags: MessageFlags.Ephemeral });
				return;
			}

			const sinceFormatted = format(since, 'dd/MM/yyyy');
			if (!absences.length) {
				await interaction.reply({
					content: `🎉 Aucune absence depuis le ${sinceFormatted}. \n \n-# Quelle assiduité ! 💪`,
					flags: MessageFlags.Ephemeral,
				});

				return;
			}

			let message = `Vous avez **${absences.length} absence${absences.length > 1 ? 's' : ''}** depuis le ${sinceFormatted}:\n`;
			message += absences
				.map((a) => `- ${format(a.absenceDate, 'dd/MM/yyyy')}${a.message ? ` — _${a.message}_` : ''}`)
				.join('\n');

			await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
		} catch (error) {
			console.error('[Voir Mes Absences Command] Unexpected error:', {
				error,
				userId: interaction.user?.id,
				channelId: interaction.channelId,
				guildId: interaction.guildId,
			});
			await interaction.reply({ content: USER_ERROR_MESSAGE, flags: MessageFlags.Ephemeral });
		}
	},
};
