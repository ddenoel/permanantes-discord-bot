import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Command } from '../command.model';
import { isBefore, startOfDay, isValid, parse } from 'date-fns';
import { App } from '../../../app';
import { Absence } from '../../../app/domain/entities/absence.entity';

const data = new SlashCommandBuilder();

data
	.setName('absence')
	.setDescription('Prévenir la troupe de votre absence')
	.addStringOption((option) => option.setName('message').setDescription("Votre message d'absence").setRequired(true))
	.addStringOption((option) =>
		option
			.setName('dates')
			.setDescription("Date(s) d'absence (format: JJ/MM/AAAA, séparer plusieurs dates par des virgules)")
			.setRequired(false)
	);

if (process.env.ENV_NAME === 'development') {
	data.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
}

const USER_ERROR_MESSAGE =
	"Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer ou contacter un administrateur si le problème persiste.";
const INVALID_DATE_FORMAT =
	"Le format des dates n'est pas valide. Utilisez le format JJ/MM/AAAA et séparez les dates par des virgules.";
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
			const absenceMessage = interaction.options.getString('message', true);
			const datesStr = interaction.options.getString('dates');
			const absentUser = interaction.user;

			let dates: Date[];
			try {
				dates = validateAndParseDates(datesStr);
			} catch (error) {
				await safeReply(interaction, error instanceof Error ? error.message : USER_ERROR_MESSAGE);
				return;
			}

			const absences: Absence[] = [];
			const app = new App(interaction.client);

			for (const date of dates) {
				try {
					const absence = await app.createAbsence.execute({
						discord: {
							guildId: interaction.guildId,
							member: {
								id: absentUser.id,
								displayName: absentUser.displayName || absentUser.globalName || absentUser.username,
							},
						},
						absenceDate: date,
						message: absenceMessage,
					});
					if (absence) {
						absences.push(absence);
					}
				} catch (error) {
					console.error('[Absence Command] Error creating absence in database:', error);
					await safeReply(interaction, USER_ERROR_MESSAGE);
					return;
				}
			}

			try {
				await app.warnAbsence.execute(absences);
				await safeReply(interaction, "Merci ! Votre message d'absence a été envoyé !");
			} catch (error) {
				console.error('[Absence Command] Error warning absence:', error);
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
