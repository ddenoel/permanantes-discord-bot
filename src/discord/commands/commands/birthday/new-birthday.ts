import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	MessageFlags,
	ActionRowBuilder,
	Interaction,
	GuildMember,
	ButtonBuilder,
	ButtonStyle,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js';
import { Command } from '../../command.model';
import { verifyRole } from '../../shared/verify-role';
import { App } from '../../../../app';
import { DateUtils } from '../../../../app/domain/utils/dates.utils';
import { MemberUtils } from '../../shared/member-utils';

const data = new SlashCommandBuilder();
data.setName('nouvel_anniversaire').setDescription("Enregistrer la date d'anniversaire d'un membre");
data.addUserOption((option) => option.setName('membre').setDescription('Le membre concerné').setRequired(true));

const MODAL_ID = 'birthday_modal';
const MONTH_INPUT_ID = 'birthday_month_input';
const DAY_INPUT_ID = 'birthday_day_input';
const CONFIRM_ID = 'birthday_confirm_update';
const CANCEL_ID = 'birthday_cancel_update';

const pendingTargetByAuthor = new Map<string, string>();
const pendingChangeByAuthor = new Map<
	string,
	{ existing: any; newDate: { month: number; day: number }; targetId: string }
>();

export const command: Command = {
	data,
	execute: async (interaction: ChatInputCommandInteraction) => {
		if (!interaction.isCommand()) return;

		try {
			const target = interaction.options.getMember('membre');
			if (!target) {
				await interaction.reply({
					content: 'Oups, je ne trouve pas cette personne dans la troupe. Réessaie avec un membre du serveur 😉',
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			// Move role check to modal submit to ensure we can open the modal within time
			pendingTargetByAuthor.set(interaction.user.id, (target as any).id);

			const modal = new ModalBuilder().setCustomId(MODAL_ID).setTitle("Date d'anniversaire");
			const monthInput = new TextInputBuilder()
				.setCustomId(MONTH_INPUT_ID)
				.setLabel('Mois (1-12)')
				.setStyle(TextInputStyle.Short)
				.setRequired(true)
				.setPlaceholder('1-12');
			const dayInput = new TextInputBuilder()
				.setCustomId(DAY_INPUT_ID)
				.setLabel('Jour (1-31)')
				.setStyle(TextInputStyle.Short)
				.setRequired(true)
				.setPlaceholder('1-31');
			const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(monthInput);
			const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(dayInput);
			modal.addComponents(row1, row2);
			await interaction.showModal(modal);
		} catch (e) {
			console.error('[Birthday Command] execute error:', e);
			try {
				const message = 'Aïe, ça a cliqué de travers ! Réessaie un peu plus tard 🤖';
				if (interaction.deferred) await interaction.editReply({ content: message });
				else await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
			} catch {}
		}
	},
	handleCommandInteractions: async (interaction: Interaction) => {
		if (interaction.isModalSubmit() && interaction.customId === MODAL_ID) {
			// Defer to avoid timeout while we validate and hit the DB
			try {
				if (!interaction.deferred && !interaction.replied) {
					await interaction.deferReply({ ephemeral: true });
				}
			} catch {}

			const monthStr = interaction.fields.getTextInputValue(MONTH_INPUT_ID);
			const dayStr = interaction.fields.getTextInputValue(DAY_INPUT_ID);
			const month = Number((monthStr || '').trim());
			const day = Number((dayStr || '').trim());
			if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) {
				await interaction.editReply({
					content: "Petit rappel: le mois c’est 1 à 12 et le jour 1 à 31. Enfin, pour l'instant... 😱",
				});
				return;
			}

			const maxDay = DateUtils.getMaxDayForMonth(month);
			if (day > maxDay) {
				await interaction.editReply({ content: `Hmm, ce mois n’a que ${maxDay} jours. On réessaye ? 🗓️` });
				return;
			}

			const app = new App(interaction.client);
			const guild = interaction.guild!;
			const targetId = pendingTargetByAuthor.get(interaction.user.id);
			if (!targetId) {
				await interaction.editReply({
					content:
						"J'ai perdu le membre ciblé... 😭 Tu peux relancer la commande et faire comme si tu n'avais rien vu ? 🧭",
				});
				return;
			}

			// Verify roles now (target must have allowed role)
			const birthdayConfig = await app.configService.get(guild.id);
			const roleOk = await verifyRole(interaction as any, birthdayConfig.discord.birthday.allowedRolesIds, targetId);
			if (!roleOk) return;

			const target = guild.members.cache.get(targetId);
			const creator = guild.members.cache.get(interaction.user.id);

			try {
				const existing = await app.birthday.retrieveBirthdayByMember.execute(target.id, guild.id);
				if (existing) {
					const same = existing.birthdayDate?.month === month && existing.birthdayDate?.day === day;
					if (same) {
						pendingTargetByAuthor.delete(interaction.user.id);
						await interaction.editReply({
							content: `Parfait ! L’anniversaire de <@${target.id}> est déjà enregistré au ${DateUtils.formatDayMonth(existing.birthdayDate.day, existing.birthdayDate.month)} 🎉 Rien à changer.`,
						});
						return;
					}

					pendingChangeByAuthor.set(interaction.user.id, {
						existing,
						newDate: { month, day },
						targetId: target.id,
					});
					const confirm = new ButtonBuilder()
						.setCustomId(CONFIRM_ID)
						.setLabel('Modifier')
						.setStyle(ButtonStyle.Success);
					const cancel = new ButtonBuilder().setCustomId(CANCEL_ID).setLabel('Annuler').setStyle(ButtonStyle.Secondary);
					const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirm, cancel);
					await interaction.editReply({
						content: `On a déjà ${DateUtils.formatDayMonth(existing.birthdayDate.day, existing.birthdayDate.month)} pour <@${target.id}>.
On remplace par ${DateUtils.formatDayMonth(day, month)} ?

-# A moins que ça ne soit une technique pour manger 2 fois plus de gâteau ? 😱 Brillant...`,
						components: [row],
					});
					return;
				}

				await app.birthday.createBirthday.execute({
					birthdayDate: { month, day },
					member: {
						id: target.id,
						displayName: MemberUtils.getDisplayName(target),
						username: target.user.username,
					},
					discordInfo: {
						guildId: guild.id,
						createdByMember: {
							id: creator.id,
							displayName: MemberUtils.getDisplayName(creator),
							username: creator.user.username,
						},
					},
				});
				pendingTargetByAuthor.delete(interaction.user.id);
				await interaction.editReply({
					content: `✅ C’est noté ! On fêtera <@${target.id}> le ${DateUtils.formatDayMonth(day, month)} 🥳`,
				});
			} catch (e) {
				console.error('[Birthday Command] Error creating/updating birthday:', e);
				await interaction.editReply({ content: "Oups, j'ai fait tomber le gâteau... Réessaie un peu plus tard 🎂" });
			}
		}

		if (interaction.isButton() && (interaction.customId === CONFIRM_ID || interaction.customId === CANCEL_ID)) {
			const pending = pendingChangeByAuthor.get(interaction.user.id);
			if (!pending) {
				await (interaction as any).update?.({
					content: '⏱️ Trop tard, la demande a expiré. On relance quand tu veux !',
					components: [],
				});
				return;
			}
			if (interaction.customId === CANCEL_ID) {
				pendingChangeByAuthor.delete(interaction.user.id);
				await interaction.update({
					content: 'Pas de souci, on garde la date actuelle. On range les confettis 🎊',
					components: [],
				});
				return;
			}

			// Confirm
			try {
				const app = new App(interaction.client);
				await app.birthday.updateBirthdayDate.execute(pending.existing, pending.newDate);
				pendingChangeByAuthor.delete(interaction.user.id);
				pendingTargetByAuthor.delete(interaction.user.id);
				await interaction.update({
					content: `✅ Mise à jour effectuée ! On fêtera l'anniversaire de <@${pending.targetId}> le ${DateUtils.formatDayMonth(pending.newDate.day, pending.newDate.month)} 🎈🎂`,
					components: [],
				});
			} catch (e) {
				console.error('[Birthday Command] Error updating birthday:', e);
				await interaction.update({ content: 'Désolé, une erreur est survenue.', components: [] });
			}
		}
	},
};
