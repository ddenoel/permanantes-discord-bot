import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, MessageFlags } from 'discord.js';
import { Command } from '../command.model';
import { format } from 'date-fns';

const data = new SlashCommandBuilder();

data
	.setName('absence')
	.setDescription('Prévenir la troupe de votre absence')
	.addStringOption((option) => option.setName('message').setDescription("Votre message d'absence").setRequired(true));

const USER_ERROR_MESSAGE =
	"Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer ou contacter un administrateur si le problème persiste.";

export const command: Command = {
	data,
	async execute(interaction: ChatInputCommandInteraction) {
		try {
			const absenceMessage = interaction.options.getString('message', true);
			const absentUser = interaction.user;
			const absenceChannelId = process.env.ABSENCE_CHANNEL_ID;

			if (!absenceChannelId) {
				console.error('[Absence Command] Configuration error: ABSENCE_CHANNEL_ID not set in environment variables');
				await interaction.reply({
					content: USER_ERROR_MESSAGE,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const absenceChannel = await interaction.client.channels.fetch(absenceChannelId);

			if (!absenceChannel) {
				console.error(`[Absence Command] Channel not found: Channel ID ${absenceChannelId} does not exist`);
				await interaction.reply({
					content: USER_ERROR_MESSAGE,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			if (!(absenceChannel instanceof TextChannel)) {
				console.error(`[Absence Command] Invalid channel type: Channel ${absenceChannelId} is not a text channel`);
				await interaction.reply({
					content: USER_ERROR_MESSAGE,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const guild = interaction.guild;
			if (!guild) {
				console.error('[Absence Command] Command used outside of a guild context');
				await interaction.reply({
					content: USER_ERROR_MESSAGE,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const notifyRoleId: string = process.env.NOTIFY_ROLE_ID || '';
			const roleTag = notifyRoleId ? `<@&${notifyRoleId}>` : '';

			const message = await absenceChannel
				.send(
					`Oh non ! ${absentUser} ne sera pas parmis nous aujourd'hui 😭 ${roleTag} \n Voici son petit mot: \n> ${absenceMessage}`
				)
				.catch(async (error) => {
					console.error('[Absence Command] Failed to send message:', {
						error,
						channelId: absenceChannelId,
						userId: absentUser.id,
						messageLength: absenceMessage.length,
					});
					await interaction.reply({
						content: USER_ERROR_MESSAGE,
						flags: MessageFlags.Ephemeral,
					});
					return null;
				});

			if (!message) return;

			const date = format(new Date(), 'dd/MM/yyyy');
			await message
				.startThread({
					name: `${date} - Absence de ${absentUser.username}`,
				})
				.catch(async (error) => {
					console.error('[Absence Command] Failed to create thread:', {
						error,
						messageId: message.id,
						channelId: absenceChannelId,
						userId: absentUser.id,
					});
					// On continue même si la création du thread échoue
				});

			await interaction.reply({
				content: "Merci! Votre message d'absence a été envoyé!",
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			console.error('[Absence Command] Unexpected error:', {
				error,
				userId: interaction.user.id,
				channelId: interaction.channelId,
				guildId: interaction.guildId,
			});

			await interaction
				.reply({
					content: USER_ERROR_MESSAGE,
					flags: MessageFlags.Ephemeral,
				})
				.catch((replyError) => {
					console.error('[Absence Command] Failed to send error reply:', {
						error: replyError,
						originalError: error,
						userId: interaction.user.id,
					});
				});
		}
	},
};
