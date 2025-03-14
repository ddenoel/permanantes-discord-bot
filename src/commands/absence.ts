import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, MessageFlags } from 'discord.js';
import { Command } from '../command.model';

const data = new SlashCommandBuilder();

data
	.setName('absence')
	.setDescription('Prévenir la troupe de votre absence')
	.addStringOption((option) => option.setName('message').setDescription("Votre message d'absence").setRequired(true));

export const command: Command = {
	data,
	async execute(interaction: ChatInputCommandInteraction) {
		const absenceMessage = interaction.options.getString('message', true);
		const absentUser = interaction.user;
		const absenceChannelId = process.env.ABSENCE_CHANNEL_ID;

		if (!absenceChannelId) {
			await interaction.reply({
				content: 'Error: Absence channel not configured!',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		try {
			const absenceChannel = await interaction.client.channels.fetch(absenceChannelId);

			if (absenceChannel instanceof TextChannel) {
				const guild = interaction.guild;
				if (!guild) {
					throw new Error('Command must be used in a guild');
				}

				const notifyRoleId: string = process.env.NOTIFY_ROLE_ID || '';
				const roleTag = notifyRoleId ? `<@&${notifyRoleId}>` : '';

				await absenceChannel.send(
					`Oh non ! ${absentUser} ne sera pas parmis nous aujourd'hui 😭 \n> ${absenceMessage} \n${roleTag}`
				);

				await interaction.reply({
					content: "Merci! Votre message d'absence a été envoyé!",
					flags: MessageFlags.Ephemeral,
				});
			} else {
				throw new Error('The configured channel is not a text channel');
			}
		} catch (error) {
			console.error('Error sending absence message:', error);
			await interaction.reply({
				content: "Une erreur est survenue lors de l'envoi de votre message d'absence.",
				flags: MessageFlags.Ephemeral,
			});
		}
	},
};
