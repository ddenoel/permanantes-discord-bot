import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	MessageFlags,
	PermissionFlagsBits,
	ActionRowBuilder,
	Interaction,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from 'discord.js';
import { Command } from '../command.model';
import { App } from '../../../app';
import { Absence } from '../../../app/domain/entities/absence.entity';
import { DateUtils } from '../../../app/domain/utils/dates.utils';
import { IPlanningEntryEntity } from '../../../app/domain/entities/planning.entity';
import { MiscellaneousUtils } from '../../../app/domain/utils/miscellaneous.utils';
import { monthEmojiByIndex } from '../../../app/domain/data/dates.data';
import { verifyRole } from './shared/verify-role';
import { getPlanningEntriesAsSelect } from './shared/get-planning-entries-as-select';

const data = new SlashCommandBuilder();

data.setName('absence').setDescription("Prévenir la troupe d'une absence (sélection d'une date)");

if (process.env.ENV_NAME === 'development') {
	data.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
}

const USER_ERROR_MESSAGE =
	"Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer ou contacter un administrateur si le problème persiste.";

const MODAL_ID = 'absence_message_modal';
const SELECT_ID = 'absence_select_date';
const MESSAGE_INPUT_ID = 'absence_message_input';
const CONFIRM_ID = 'absence_confirm';
const CANCEL_ID = 'absence_cancel';
const MANUAL_DATE_MODAL_ID = 'absence_manual_date_modal';
const MANUAL_DATE_INPUT_ID = 'absence_manual_date_input';
const MANUAL_DATE_BTN_ID = 'absence_manual_date_btn';
const PREV_DATES_BTN_ID = 'absence_prev_dates_btn';
const NEXT_DATES_BTN_ID = 'absence_next_dates_btn';

const pendingAbsenceByUser = new Map<string, { date: Date; message?: string }>();
const lastSelectInteractionByUser = new Map<string, Interaction>();
const disabledIsoValuesByUser = new Map<string, Set<string>>();
const paginationHandlerByUser = new Map<string, (i: Interaction) => Promise<void>>();

const manualDateBtn = new ButtonBuilder()
	.setCustomId(MANUAL_DATE_BTN_ID)
	.setLabel('📅 Choisir une date manuellement')
	.setStyle(ButtonStyle.Primary);

export const command: Command = {
	data,
	async execute(interaction: ChatInputCommandInteraction) {
		if (!interaction.isCommand()) return;
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const roleOk = await verifyRole(interaction, process.env.ABSENCE_ALLOWED_ROLE_ID);
			if (!roleOk) return;

			const app = new App(interaction.client);
			let entries: IPlanningEntryEntity[] = [];
			try {
				entries = await app.retrieveFuturePlanningEntries.execute();
			} catch (e) {
				console.error('[Absence Command] Error retrieving future planning entries:', e);
				entries = [];
			}

			if (!entries.length) {
				const row = new ActionRowBuilder<ButtonBuilder>().addComponents(manualDateBtn);
				await interaction.editReply({
					content: 'Aucune répétition trouvée. Vous pouvez choisir une date manuellement :',
					components: [row],
				});

				return;
			}

			// Retrieve user's upcoming absences to disable options where already absent
			let userAbsences: Absence[] = [];
			try {
				const { absences } = await app.retrieveAbsencesOfUser.execute(interaction.user.id);
				userAbsences = absences;
			} catch (e) {
				console.warn('[Absence Command] Could not retrieve user absences:', e);
			}

			const disabledIsoValues = new Set<string>(userAbsences.map((a) => new Date(a.absenceDate).toISOString()));
			disabledIsoValuesByUser.set(interaction.user.id, disabledIsoValues);

			// Keep a reference to the initial command interaction to clear its message later
			lastSelectInteractionByUser.set(interaction.user.id, interaction);

			const { components, handleInteraction } = getPlanningEntriesAsSelect(interaction, entries, {
				customIds: { select: SELECT_ID, prev: PREV_DATES_BTN_ID, next: NEXT_DATES_BTN_ID },
				pageIndex: 0,
				pageSize: 25,
				disabledIsoValues,
				manualDateButton: manualDateBtn,
			});
			paginationHandlerByUser.set(interaction.user.id, handleInteraction);
			await interaction.editReply({
				content: '📅 Sélectionnez la date de répétition où vous ne serez pas là :',
				components,
			});
		} catch (error) {
			console.error('[Absence Command] Unexpected error:', error);
			await interaction.editReply({ content: USER_ERROR_MESSAGE });
		}
	},
	handleCommandInteractions: async (interaction: Interaction) => {
		try {
			if (await handleDateSelection(interaction)) return;
			if (await handleMessageModalSubmit(interaction)) return;
			if (await handleConfirm(interaction)) return;
			if (await handleManualDateSelection(interaction)) return;

			if (
				interaction.isButton() &&
				(interaction.customId === NEXT_DATES_BTN_ID || interaction.customId === PREV_DATES_BTN_ID)
			) {
				const handler = paginationHandlerByUser.get(interaction.user.id);
				if (handler) await handler(interaction);
				return;
			}
		} catch (error) {
			console.error('[Absence Command] Interaction error:', error);
			try {
				await (interaction as any).reply?.({ content: USER_ERROR_MESSAGE, flags: MessageFlags.Ephemeral });
			} catch {}
		}
	},
};

// pagination now handled by shared helper via paginationHandlerByUser

const MESSAGE_PLACEHOLDERS: string[] = [
	"Désolé, j'ai aquaponey ce jour-là et je monte pomponette!",
	'J’aurais adoré, mais mon chat passe son permis bateau.',
	'Désolé, j’ai déjà un rendez-vous avec mon destin (et il est en retard).',
	'Je dois nourrir mon Tamagotchi, c’est une question de survie.',
	'Je suis pris, j’ai karaoké médiéval avec les voisins.',
	'J’ai une mission top secrète... Donc je ne peux rien vous dire...',
	'Désolé, c’est le grand nettoyage annuel de mes onglets Chrome.',
	'Je dois calibrer mes chaussettes pour l’hiver.',
];

async function handleDateSelection(interaction: Interaction) {
	if (interaction.isStringSelectMenu() && interaction.customId === SELECT_ID) {
		const userId = interaction.user.id;
		const iso = interaction.values?.[0];
		if (!iso) {
			await interaction.reply({ content: 'Sélection invalide.', flags: MessageFlags.Ephemeral });
			return;
		}

		const disabledSet = disabledIsoValuesByUser.get(userId);
		if (disabledSet && disabledSet.has(iso)) {
			await interaction.reply({ content: 'Vous êtes déjà absent ce jour.', flags: MessageFlags.Ephemeral });
			return true;
		}

		const date = new Date(iso);
		pendingAbsenceByUser.set(userId, { date });

		const modal = new ModalBuilder().setCustomId(MODAL_ID).setTitle("Votre message d'absence (optionnel)");
		const input = new TextInputBuilder()
			.setCustomId(MESSAGE_INPUT_ID)
			.setLabel('Message')
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(false)
			.setPlaceholder(MiscellaneousUtils.getRandomAmongList(MESSAGE_PLACEHOLDERS));
		const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
		modal.addComponents(row);
		await interaction.showModal(modal);

		return true;
	}

	return false;
}

async function handleManualDateSelection(interaction: Interaction) {
	if (interaction.isButton() && interaction.customId === MANUAL_DATE_BTN_ID) {
		const modal = new ModalBuilder().setCustomId(MANUAL_DATE_MODAL_ID).setTitle('Saisir date et message');
		const dateInput = new TextInputBuilder()
			.setCustomId(MANUAL_DATE_INPUT_ID)
			.setLabel('Date (JJ/MM/AAAA)')
			.setStyle(TextInputStyle.Short)
			.setRequired(true)
			.setPlaceholder(DateUtils.formatDate(new Date()));
		const msgInput = new TextInputBuilder()
			.setCustomId(MESSAGE_INPUT_ID)
			.setLabel("Message d'absence (optionnel)")
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(false)
			.setPlaceholder(MiscellaneousUtils.getRandomAmongList(MESSAGE_PLACEHOLDERS));
		const rowDate = new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput);
		const rowMsg = new ActionRowBuilder<TextInputBuilder>().addComponents(msgInput);
		modal.addComponents(rowDate, rowMsg);
		await interaction.showModal(modal);

		return true;
	}

	return false;
}

async function handleMessageModalSubmit(interaction: Interaction) {
	if (interaction.isModalSubmit() && interaction.customId === MODAL_ID) {
		const userId = interaction.user.id;
		const data = pendingAbsenceByUser.get(userId);
		if (!data) {
			await interaction.reply({ content: USER_ERROR_MESSAGE, flags: MessageFlags.Ephemeral });
			return;
		}
		const message = interaction.fields.getTextInputValue(MESSAGE_INPUT_ID) || '';
		pendingAbsenceByUser.set(userId, { ...data, message });

		const confirm = new ButtonBuilder().setCustomId(CONFIRM_ID).setLabel('Confirmer').setStyle(ButtonStyle.Success);
		const cancel = new ButtonBuilder().setCustomId(CANCEL_ID).setLabel('Annuler').setStyle(ButtonStyle.Secondary);
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirm, cancel);

		let content = `Confirmer votre absence pour le **${DateUtils.formatDate(data.date)}**`;
		if (message) {
			content += `\nVotre message:`;
			content += `\n> ${message} \n\n-# Vous êtes vraiment sûr ?`;
		}
		const root = lastSelectInteractionByUser.get(userId) as any;
		if (root && root.editReply) {
			await root.editReply({ content, components: [row] });
			// Acknowledge the modal to avoid client error and close it without leaving extra messages
			try {
				if (!interaction.deferred && !interaction.replied) {
					await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				}
				await interaction.deleteReply().catch(() => {});
			} catch {}
		} else {
			await interaction.reply({ content, flags: MessageFlags.Ephemeral, components: [row] });
		}

		return true;
	}

	if (interaction.isModalSubmit() && interaction.customId === MANUAL_DATE_MODAL_ID) {
		const userId = interaction.user.id;
		const inputDate = interaction.fields.getTextInputValue(MANUAL_DATE_INPUT_ID);
		const inputMsg = interaction.fields.getTextInputValue(MESSAGE_INPUT_ID) || '';
		const parsed = DateUtils.parseFrenchDate(inputDate);
		if (!parsed) {
			await interaction.reply({ content: 'Format invalide. Utilisez JJ/MM/AAAA.', flags: MessageFlags.Ephemeral });
			return true;
		}
		pendingAbsenceByUser.set(userId, { date: parsed, message: inputMsg });

		const confirm = new ButtonBuilder().setCustomId(CONFIRM_ID).setLabel('Confirmer').setStyle(ButtonStyle.Success);
		const cancel = new ButtonBuilder().setCustomId(CANCEL_ID).setLabel('Annuler').setStyle(ButtonStyle.Secondary);
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirm, cancel);
		const root = lastSelectInteractionByUser.get(userId) as any;
		if (root && root.editReply) {
			await root.editReply({
				content: `Date choisie: **${DateUtils.formatDate(parsed)}**${inputMsg ? `\n> ${inputMsg}` : ''}`,
				components: [row],
			});
			// Acknowledge the modal and close it silently
			try {
				if (!interaction.deferred && !interaction.replied) {
					await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				}
				await interaction.deleteReply().catch(() => {});
			} catch {}
		} else {
			await interaction.reply({
				content: `Date choisie: **${DateUtils.formatDate(parsed)}**${inputMsg ? `\n> ${inputMsg}` : ''}`,
				flags: MessageFlags.Ephemeral,
				components: [row],
			});
		}
		return true;
	}

	return false;
}

async function handleConfirm(interaction: Interaction) {
	if (interaction.isButton() && interaction.customId === CONFIRM_ID) {
		const userId = interaction.user.id;
		const data = pendingAbsenceByUser.get(userId);
		if (!data) {
			const root = lastSelectInteractionByUser.get(userId) as any;
			if (root && root.editReply) {
				await root.editReply({ content: USER_ERROR_MESSAGE, components: [] });
			} else {
				await interaction.update({ content: USER_ERROR_MESSAGE, components: [] });
			}

			return;
		}
		const app = new App(interaction.client);
		const member = interaction.guild.members.cache.get(userId);
		let absence: Absence | null = null;
		try {
			absence = await app.createAbsence.execute({
				discord: {
					guildId: interaction.guildId,
					member: {
						id: userId,
						displayName:
							member.displayName ||
							member.nickname ||
							interaction.user.displayName ||
							interaction.user.globalName ||
							interaction.user.username,
						username: interaction.user.username,
					},
				},
				absenceDate: data.date,
				message: data.message || '',
			});
		} catch (e) {
			console.error('[Absence Command] Error creating absence:', e);
			const root = lastSelectInteractionByUser.get(userId) as any;
			if (root && root.editReply) {
				await root.editReply({ content: USER_ERROR_MESSAGE, components: [] });
			} else {
				await interaction.update({ content: USER_ERROR_MESSAGE, components: [] });
			}
			pendingAbsenceByUser.delete(userId);

			return;
		}

		try {
			if (absence) {
				await new App(interaction.client).warnAbsence.execute([absence]);
			}
		} catch (e) {
			console.error('[Absence Command] Error warning absence:', e);
		}

		pendingAbsenceByUser.delete(userId);
		const root = lastSelectInteractionByUser.get(userId) as any;
		const content = `✅ Merci ! Votre absence pour le **${DateUtils.formatDateWithWeekday(data.date)}** a bien été enregistrée !`;
		if (root && root.editReply) {
			await root.editReply({ content, components: [] });
		} else {
			await interaction.update({ content, components: [] });
		}
		return true;
	}

	if (interaction.isButton() && interaction.customId === CANCEL_ID) {
		const userId = interaction.user.id;
		pendingAbsenceByUser.delete(userId);
		const root = lastSelectInteractionByUser.get(userId) as any;
		const content = 'Opération annulée. \n\n-# Fiou ! Content que vous soyiez là finalement !';
		if (root && root.editReply) {
			await root.editReply({ content, components: [] });
		} else {
			await interaction.update({ content, components: [] });
		}

		return true;
	}

	return false;
}
