import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, MessageFlags } from 'discord.js';
import { Command } from '../command.model';
import { format, isBefore, startOfDay, isValid, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { scheduleAbsenceReminder } from '../services/absence-scheduler';

const data = new SlashCommandBuilder();

data
	.setName('absence')
	.setDescription('Prévenir la troupe de votre absence')
	.addStringOption((option) => option.setName('message').setDescription("Votre message d'absence").setRequired(true))
	.addStringOption((option) =>
		option
			.setName('dates')
			.setDescription("Date(s) d'absence (format: JJ/MM/YYYY, séparer plusieurs dates par des virgules)")
			.setRequired(false)
	);

const USER_ERROR_MESSAGE =
	"Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer ou contacter un administrateur si le problème persiste.";
const INVALID_DATE_FORMAT =
	"Le format des dates n'est pas valide. Utilisez le format JJ/MM/YYYY et séparez les dates par des virgules.";
const PAST_DATE_ERROR = "Les dates d'absence doivent être aujourd'hui ou dans le futur.";

function validateAndParseDates(datesStr: string | null): Date[] {
	if (!datesStr) {
		return [new Date()];
	}

	const dates = datesStr.split(',').map((d) => d.trim());
	const parsedDates: Date[] = [];
	const today = startOfDay(new Date());

	for (const dateStr of dates) {
		const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());

		if (!isValid(parsed)) {
			throw new Error(INVALID_DATE_FORMAT);
		}

		if (isBefore(parsed, today)) {
			throw new Error(PAST_DATE_ERROR);
		}

		parsedDates.push(parsed);
	}

	return parsedDates;
}

function formatDateList(dates: Date[]): string {
	if (dates.length === 1) {
		if (isSameDay(dates[0], new Date())) {
			return "aujourd'hui";
		}
		return `le ${format(dates[0], 'dd MMMM yyyy', { locale: fr })}`;
	}

	const formattedDates = dates.map((d) => format(d, 'dd MMMM yyyy', { locale: fr }));
	return `les ${formattedDates.slice(0, -1).join(', ')} et ${formattedDates.slice(-1)}`;
}

function isSameDay(date1: Date, date2: Date): boolean {
	return startOfDay(date1).getTime() === startOfDay(date2).getTime();
}

export const command: Command = {
	data,
	async execute(interaction: ChatInputCommandInteraction) {
		try {
			const absenceMessage = interaction.options.getString('message', true);
			const datesStr = interaction.options.getString('dates');
			const absentUser = interaction.user;
			const absenceChannelId = process.env.ABSENCE_CHANNEL_ID;

			let dates: Date[];
			try {
				dates = validateAndParseDates(datesStr);
			} catch (error) {
				await interaction.reply({
					content: error instanceof Error ? error.message : USER_ERROR_MESSAGE,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

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

			const formattedDates = formatDateList(dates);
			const today = new Date();

			// Always send immediate message with all dates
			const message = await absenceChannel
				.send(
					`Oh non ! ${absentUser} ne sera pas parmi nous ${formattedDates} 😭 ${roleTag}\n --- \nVoici son petit mot :\n> ${absenceMessage}`
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

			const threadDate = format(dates[0], 'dd/MM/yyyy');
			await message
				.startThread({
					name: `${threadDate} - Absence de ${absentUser?.displayName || absentUser?.username || ''}`,
					autoArchiveDuration: 60 * 60 * 24 * 7, // 7 days
				})
				.catch(async (error) => {
					console.error('[Absence Command] Failed to create thread:', {
						error,
						messageId: message.id,
						channelId: absenceChannelId,
						userId: absentUser.id,
					});
				});

			// Schedule future reminders
			const futureDates = dates.filter((date) => !isSameDay(date, today));
			if (futureDates.length > 0) {
				for (const date of futureDates) {
					scheduleAbsenceReminder(interaction.client, {
						userId: absentUser.id,
						message,
						date,
						channelId: absenceChannelId,
					});
				}
			}

			await interaction.reply({
				content: "Merci ! Votre message d'absence a été envoyé !",
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
