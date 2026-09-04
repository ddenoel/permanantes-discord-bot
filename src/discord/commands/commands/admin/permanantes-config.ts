import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelSelectMenuBuilder,
	ChannelType,
	ChatInputCommandInteraction,
	EmbedBuilder,
	Interaction,
	MessageFlags,
	ModalBuilder,
	PermissionFlagsBits,
	RoleSelectMenuBuilder,
	SlashCommandBuilder,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js';
import { Command } from '../../command.model';
import { App } from '../../../../app';
import { PermanantesConfig } from '../../../../app/domain/entities/permanantes-config.entity';
import { EMBED_COLOR } from '../../../../app/domain/data/style.data';
import { DateUtils } from '../../../../app/domain/utils/dates.utils';
import { warnTasksScheduler } from '../../../../infrastructure/warn-tasks-scheduler';

const data = new SlashCommandBuilder()
	.setName('permanantes_config')
	.setDescription('Configurer les salons, rôles et le planning Google Sheets')
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const PREFIX = 'permanantes_config';
const SECTION_HOME = `${PREFIX}:section:home`;
const SECTION_MATERIAL = `${PREFIX}:section:material`;
const SECTION_ABSENCE = `${PREFIX}:section:absence`;
const SECTION_BIRTHDAY = `${PREFIX}:section:birthday`;
const SECTION_PLANNING = `${PREFIX}:section:planning`;
const SECTION_SCHEDULES = `${PREFIX}:section:schedules`;

const SELECT_MATERIAL_CHANNEL = `${PREFIX}:select:material.channelId`;
const SELECT_MATERIAL_INFORM = `${PREFIX}:select:material.informChannelId`;
const SELECT_ABSENCE_CHANNEL = `${PREFIX}:select:absence.channelId`;
const SELECT_ABSENCE_NOTIFY_ROLE = `${PREFIX}:select:absence.roleToNotifyId`;
const SELECT_ABSENCE_ALLOWED_ROLES = `${PREFIX}:select:absence.allowedRolesIds`;
const SELECT_BIRTHDAY_CHANNEL = `${PREFIX}:select:birthday.channelId`;
const SELECT_BIRTHDAY_ALLOWED_ROLES = `${PREFIX}:select:birthday.allowedRolesIds`;

const PLANNING_MODAL_ID = `${PREFIX}:modal:planning`;
const PLANNING_SHEET_ID_INPUT = `${PREFIX}:input:googleSheetId`;
const PLANNING_SHEET_NAME_INPUT = `${PREFIX}:input:sheetName`;

const SCHEDULES_MODAL_ID = `${PREFIX}:modal:schedules`;
const ABSENCE_WARN_TIME_INPUT = `${PREFIX}:input:absence.warnTime`;
const BIRTHDAY_WARN_TIME_INPUT = `${PREFIX}:input:birthday.warnTime`;

const USER_ERROR_MESSAGE =
	"Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer ou contacter un administrateur si le problème persiste.";

type FieldMeta = { title: string; caption?: string };

const FIELD_META = {
	materialChannel: {
		title: 'Salon ressources',
		caption: 'Forum où sont publiées les ressources de la troupe',
	},
	materialInform: {
		title: "Salon d'info",
		caption: "Salon où sera posté le message d'avertissement de nouvelle ressource",
	},
	absenceChannel: {
		title: 'Salon des absences',
		caption: 'Là où seront publiées les absences. Permabot doit avoir le droit de poster dans ce channel',
	},
	absenceNotifyRole: {
		title: 'Rôle notifié',
		caption: "Rôle qui recevra une notification lors d'une absence",
	},
	absenceAllowedRoles: {
		title: 'Rôles autorisés',
		caption: 'Rôles qui peuvent déclarer une absence',
	},
	birthdayChannel: {
		title: 'Salon des anniversaires',
		caption: 'Salon où seront publiés les anniversaires',
	},
	birthdayAllowedRoles: {
		title: 'Rôles autorisés',
		caption: 'Rôles dont les anniversaires seront publiés dans ce salon',
	},
	planningSheetId: {
		title: 'Sheet ID',
		caption:
			"Identifiant contenu dans l'URL du fichier Google Sheets : https://docs.google.com/spreadsheets/d/IDENTIFIANT/edit. Pensez à partager à permabot@permanantes.iam.gserviceaccount.com l'accès à ce fichier en Editeur.",
	},
	planningSheetName: {
		title: "Nom de l'onglet",
		caption: "Nom exact de l'onglet dans lequel sont stockées les données de planning",
	},
	absenceWarnTime: {
		title: 'Heure des absences',
		caption: 'Heure à laquelle le rappel des absences du jour est publié ',
	},
	birthdayWarnTime: {
		title: 'Heure des anniversaires',
		caption: 'Heure à laquelle les anniversaires du jour sont publiés',
	},
} as const satisfies Record<string, FieldMeta>;

function isAdmin(interaction: Interaction): boolean {
	if (!interaction.memberPermissions) return false;
	return interaction.memberPermissions.has(PermissionFlagsBits.Administrator);
}

function mentionChannel(id?: string): string {
	return id ? `<#${id}>` : '_non configuré_';
}

function mentionRole(id?: string): string {
	return id ? `<@&${id}>` : '_non configuré_';
}

function mentionRoles(ids?: string[]): string {
	if (!ids?.length) return '_non configuré_';
	return ids.map((id) => `<@&${id}>`).join(', ');
}

function formatFieldValue(meta: FieldMeta, current: string): string {
	const lines: string[] = [];
	if (meta.caption) lines.push(`_${meta.caption}_`);
	lines.push(`Actuel : ${current}`);
	return lines.join('\n');
}

function embedField(meta: FieldMeta, current: string) {
	return {
		name: meta.title,
		value: formatFieldValue(meta, current),
	};
}

function summaryLine(meta: FieldMeta, current: string): string {
	return meta.caption ? `${meta.title} : ${current} \n-# _${meta.caption}_\n` : `${meta.title} : ${current}`;
}

function buildSummaryEmbed(config: PermanantesConfig): EmbedBuilder {
	return new EmbedBuilder()
		.setColor(parseInt(EMBED_COLOR.replace('#', ''), 16))
		.setTitle('⚙️ Configuration Permabot')
		.setDescription(`---`)
		.addFields(
			{
				name: '🎼│ Ressources',
				value: [
					summaryLine(FIELD_META.materialChannel, mentionChannel(config.discord.material.channelId)),
					summaryLine(FIELD_META.materialInform, mentionChannel(config.discord.material.informChannelId)),
					'---',
				].join('\n'),
			},
			{
				name: '🤒│ Absences',
				value: [
					summaryLine(FIELD_META.absenceChannel, mentionChannel(config.discord.absence.channelId)),
					summaryLine(FIELD_META.absenceNotifyRole, mentionRole(config.discord.absence.roleToNotifyId)),
					summaryLine(FIELD_META.absenceAllowedRoles, mentionRoles(config.discord.absence.allowedRolesIds)),
					'---',
				].join('\n'),
			},
			{
				name: '🎂│ Anniversaires',
				value: [
					summaryLine(FIELD_META.birthdayChannel, mentionChannel(config.discord.birthday.channelId)),
					summaryLine(FIELD_META.birthdayAllowedRoles, mentionRoles(config.discord.birthday.allowedRolesIds)),
					'---',
				].join('\n'),
			},
			{
				name: '📊│ Planning Google',
				value: [
					summaryLine(FIELD_META.planningSheetId, `\`${config.planning.googleSheetId || '—'}\``),
					summaryLine(FIELD_META.planningSheetName, `\`${config.planning.sheetName || '—'}\``),
					'---',
				].join('\n'),
			},
			{
				name: '⏰│ Horaires des alertes',
				value: [
					summaryLine(FIELD_META.absenceWarnTime, `\`${config.discord.absence.warnTime}\``),
					summaryLine(FIELD_META.birthdayWarnTime, `\`${config.discord.birthday.warnTime}\``),
					'---',
				].join('\n'),
			}
		);
}

function sectionButtons(active?: string): ActionRowBuilder<ButtonBuilder>[] {
	const mk = (id: string, label: string, style: ButtonStyle = ButtonStyle.Secondary) =>
		new ButtonBuilder()
			.setCustomId(id)
			.setLabel(label)
			.setStyle(id === active ? ButtonStyle.Primary : style);

	return [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			mk(SECTION_MATERIAL, '🎼 Ressources'),
			mk(SECTION_ABSENCE, '🤒 Absences'),
			mk(SECTION_BIRTHDAY, '🎂 Anniversaires'),
			mk(SECTION_PLANNING, '📊 Planning'),
			mk(SECTION_SCHEDULES, '⏰ Horaires')
		),
		new ActionRowBuilder<ButtonBuilder>().addComponents(mk(SECTION_HOME, '🏠 Accueil')),
	];
}

function withDefaultChannel(select: ChannelSelectMenuBuilder, channelId?: string): ChannelSelectMenuBuilder {
	if (channelId) select.setDefaultChannels(channelId);
	return select;
}

function withDefaultRoles(select: RoleSelectMenuBuilder, roleIds?: string[]): RoleSelectMenuBuilder {
	if (roleIds?.length) {
		const max = select.data.max_values ?? roleIds.length;
		select.setDefaultRoles(...roleIds.slice(0, max));
	}
	return select;
}

async function buildHomeView(config: PermanantesConfig) {
	return {
		embeds: [buildSummaryEmbed(config)],
		components: sectionButtons(SECTION_HOME),
	};
}

async function buildMaterialView(config: PermanantesConfig) {
	const materialChannel = withDefaultChannel(
		new ChannelSelectMenuBuilder()
			.setCustomId(SELECT_MATERIAL_CHANNEL)
			.setPlaceholder(FIELD_META.materialChannel.title)
			.setMinValues(1)
			.setMaxValues(1)
			.addChannelTypes(ChannelType.GuildForum, ChannelType.GuildText),
		config.discord.material.channelId
	);
	const informChannel = withDefaultChannel(
		new ChannelSelectMenuBuilder()
			.setCustomId(SELECT_MATERIAL_INFORM)
			.setPlaceholder(FIELD_META.materialInform.title)
			.setMinValues(1)
			.setMaxValues(1)
			.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
		config.discord.material.informChannelId
	);

	return {
		embeds: [
			sectionEmbed('🎼│ Ressources', [
				embedField(FIELD_META.materialChannel, mentionChannel(config.discord.material.channelId)),
				embedField(FIELD_META.materialInform, mentionChannel(config.discord.material.informChannelId)),
			]),
		],
		components: [
			...sectionButtons(SECTION_MATERIAL),
			new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(materialChannel),
			new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(informChannel),
		],
	};
}

async function buildAbsenceView(config: PermanantesConfig) {
	const channel = withDefaultChannel(
		new ChannelSelectMenuBuilder()
			.setCustomId(SELECT_ABSENCE_CHANNEL)
			.setPlaceholder(FIELD_META.absenceChannel.title)
			.setMinValues(1)
			.setMaxValues(1)
			.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
		config.discord.absence.channelId
	);
	const notifyRole = withDefaultRoles(
		new RoleSelectMenuBuilder()
			.setCustomId(SELECT_ABSENCE_NOTIFY_ROLE)
			.setPlaceholder(FIELD_META.absenceNotifyRole.title)
			.setMinValues(1)
			.setMaxValues(1),
		config.discord.absence.roleToNotifyId ? [config.discord.absence.roleToNotifyId] : []
	);
	const allowedRoles = withDefaultRoles(
		new RoleSelectMenuBuilder()
			.setCustomId(SELECT_ABSENCE_ALLOWED_ROLES)
			.setPlaceholder(FIELD_META.absenceAllowedRoles.title)
			.setMinValues(0)
			.setMaxValues(10),
		config.discord.absence.allowedRolesIds
	);

	return {
		embeds: [
			sectionEmbed('🤒│ Absences', [
				embedField(FIELD_META.absenceChannel, mentionChannel(config.discord.absence.channelId)),
				embedField(FIELD_META.absenceNotifyRole, mentionRole(config.discord.absence.roleToNotifyId)),
				embedField(FIELD_META.absenceAllowedRoles, mentionRoles(config.discord.absence.allowedRolesIds)),
			]),
		],
		components: [
			...sectionButtons(SECTION_ABSENCE),
			new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channel),
			new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(notifyRole),
			new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(allowedRoles),
		],
	};
}

async function buildBirthdayView(config: PermanantesConfig) {
	const channel = withDefaultChannel(
		new ChannelSelectMenuBuilder()
			.setCustomId(SELECT_BIRTHDAY_CHANNEL)
			.setPlaceholder(FIELD_META.birthdayChannel.title)
			.setMinValues(1)
			.setMaxValues(1)
			.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
		config.discord.birthday.channelId
	);
	const allowedRoles = withDefaultRoles(
		new RoleSelectMenuBuilder()
			.setCustomId(SELECT_BIRTHDAY_ALLOWED_ROLES)
			.setPlaceholder(FIELD_META.birthdayAllowedRoles.title)
			.setMinValues(0)
			.setMaxValues(10),
		config.discord.birthday.allowedRolesIds
	);

	return {
		embeds: [
			sectionEmbed('🎂│ Anniversaires', [
				embedField(FIELD_META.birthdayChannel, mentionChannel(config.discord.birthday.channelId)),
				embedField(FIELD_META.birthdayAllowedRoles, mentionRoles(config.discord.birthday.allowedRolesIds)),
			]),
		],
		components: [
			...sectionButtons(SECTION_BIRTHDAY),
			new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channel),
			new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(allowedRoles),
		],
	};
}

function truncateForPlaceholder(text: string, max = 100): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 1)}…`;
}

function buildPlanningModal(config: PermanantesConfig): ModalBuilder {
	const modal = new ModalBuilder().setCustomId(PLANNING_MODAL_ID).setTitle('📊 Planning Google');
	const sheetIdInput = new TextInputBuilder()
		.setCustomId(PLANNING_SHEET_ID_INPUT)
		.setLabel(FIELD_META.planningSheetId.title)
		.setStyle(TextInputStyle.Short)
		.setRequired(true)
		.setPlaceholder(truncateForPlaceholder(FIELD_META.planningSheetId.caption));
	if (config.planning.googleSheetId) {
		sheetIdInput.setValue(config.planning.googleSheetId);
	}
	const sheetNameInput = new TextInputBuilder()
		.setCustomId(PLANNING_SHEET_NAME_INPUT)
		.setLabel(FIELD_META.planningSheetName.title)
		.setStyle(TextInputStyle.Short)
		.setRequired(true)
		.setPlaceholder(truncateForPlaceholder(FIELD_META.planningSheetName.caption));
	if (config.planning.sheetName) {
		sheetNameInput.setValue(config.planning.sheetName);
	}

	modal.addComponents(
		new ActionRowBuilder<TextInputBuilder>().addComponents(sheetIdInput),
		new ActionRowBuilder<TextInputBuilder>().addComponents(sheetNameInput)
	);
	return modal;
}

function buildSchedulesModal(config: PermanantesConfig): ModalBuilder {
	const modal = new ModalBuilder().setCustomId(SCHEDULES_MODAL_ID).setTitle('⏰ Horaires des alertes');
	const absenceInput = new TextInputBuilder()
		.setCustomId(ABSENCE_WARN_TIME_INPUT)
		.setLabel(FIELD_META.absenceWarnTime.title)
		.setStyle(TextInputStyle.Short)
		.setRequired(true)
		.setPlaceholder('07:00')
		.setValue(DateUtils.normalizeHhMm(config.discord.absence.warnTime, DateUtils.DEFAULT_ABSENCE_WARN_TIME));
	const birthdayInput = new TextInputBuilder()
		.setCustomId(BIRTHDAY_WARN_TIME_INPUT)
		.setLabel(FIELD_META.birthdayWarnTime.title)
		.setStyle(TextInputStyle.Short)
		.setRequired(true)
		.setPlaceholder('08:00')
		.setValue(DateUtils.normalizeHhMm(config.discord.birthday.warnTime, DateUtils.DEFAULT_BIRTHDAY_WARN_TIME));

	modal.addComponents(
		new ActionRowBuilder<TextInputBuilder>().addComponents(absenceInput),
		new ActionRowBuilder<TextInputBuilder>().addComponents(birthdayInput)
	);
	return modal;
}

function sectionEmbed(title: string, fields: ReturnType<typeof embedField>[]) {
	return new EmbedBuilder()
		.setColor(parseInt(EMBED_COLOR.replace('#', ''), 16))
		.setTitle(title)
		.setDescription('---')
		.addFields(fields);
}

async function denyIfNotAdmin(interaction: Interaction): Promise<boolean> {
	if (isAdmin(interaction)) return false;
	const content = 'Cette commande est réservée aux administrateur·ices. Pas de triche 😼';
	if (interaction.isRepliable()) {
		if (interaction.deferred || interaction.replied) {
			await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
		} else {
			await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
		}
	}
	return true;
}

export const command: Command = {
	data,
	async execute(interaction: ChatInputCommandInteraction) {
		if (!interaction.isCommand()) return;

		try {
			if (await denyIfNotAdmin(interaction)) return;

			const app = new App(interaction.client);
			const config = await app.configService.get(interaction.guildId!);
			const view = await buildHomeView(config);
			await interaction.reply({ ...view, flags: MessageFlags.Ephemeral });
		} catch (error) {
			console.error('[Permanantes Config] execute error:', error);
			if (interaction.deferred || interaction.replied) {
				await interaction.editReply({ content: USER_ERROR_MESSAGE });
			} else {
				await interaction.reply({ content: USER_ERROR_MESSAGE, flags: MessageFlags.Ephemeral });
			}
		}
	},
	async handleCommandInteractions(interaction: Interaction) {
		const customId =
			interaction.isButton() ||
			interaction.isChannelSelectMenu() ||
			interaction.isRoleSelectMenu() ||
			interaction.isModalSubmit()
				? interaction.customId
				: null;
		if (!customId?.startsWith(PREFIX)) return;

		try {
			if (await denyIfNotAdmin(interaction)) return;

			const guildId = interaction.guildId;
			if (!guildId) return;

			const app = new App(interaction.client);
			const configService = app.configService;

			if (interaction.isButton()) {
				if (interaction.customId === SECTION_PLANNING) {
					const config = await configService.get(guildId);
					await interaction.showModal(buildPlanningModal(config));
					return;
				}
				if (interaction.customId === SECTION_SCHEDULES) {
					const config = await configService.get(guildId);
					await interaction.showModal(buildSchedulesModal(config));
					return;
				}

				const config = await configService.get(guildId);
				let view;
				switch (interaction.customId) {
					case SECTION_HOME:
						view = await buildHomeView(config);
						break;
					case SECTION_MATERIAL:
						view = await buildMaterialView(config);
						break;
					case SECTION_ABSENCE:
						view = await buildAbsenceView(config);
						break;
					case SECTION_BIRTHDAY:
						view = await buildBirthdayView(config);
						break;
					default:
						return;
				}
				await interaction.update(view);
				return;
			}

			if (interaction.isChannelSelectMenu()) {
				const channelId = interaction.values[0];
				let patch: Parameters<typeof configService.patch>[1] = {};
				let section: 'material' | 'absence' | 'birthday' = 'material';

				switch (interaction.customId) {
					case SELECT_MATERIAL_CHANNEL:
						patch = { discord: { material: { channelId } } };
						section = 'material';
						break;
					case SELECT_MATERIAL_INFORM:
						patch = { discord: { material: { informChannelId: channelId } } };
						section = 'material';
						break;
					case SELECT_ABSENCE_CHANNEL:
						patch = { discord: { absence: { channelId } } };
						section = 'absence';
						break;
					case SELECT_BIRTHDAY_CHANNEL:
						patch = { discord: { birthday: { channelId } } };
						section = 'birthday';
						break;
					default:
						return;
				}

				const config = await configService.patch(guildId, patch);
				const view =
					section === 'material'
						? await buildMaterialView(config)
						: section === 'absence'
							? await buildAbsenceView(config)
							: await buildBirthdayView(config);
				await interaction.update(view);
				await interaction.followUp({
					content: `✅ Salon mis à jour : <#${channelId}>`,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			if (interaction.isRoleSelectMenu()) {
				const roleIds = interaction.values;
				let patch: Parameters<typeof configService.patch>[1] = {};
				let section: 'absence' | 'birthday' = 'absence';
				let confirmation = '';

				switch (interaction.customId) {
					case SELECT_ABSENCE_NOTIFY_ROLE:
						patch = { discord: { absence: { roleToNotifyId: roleIds[0] || '' } } };
						section = 'absence';
						confirmation = roleIds[0] ? `✅ Rôle notifié : <@&${roleIds[0]}>` : '✅ Rôle notifié réinitialisé';
						break;
					case SELECT_ABSENCE_ALLOWED_ROLES:
						patch = { discord: { absence: { allowedRolesIds: roleIds } } };
						section = 'absence';
						confirmation = `✅ Rôles absences : ${mentionRoles(roleIds)}`;
						break;
					case SELECT_BIRTHDAY_ALLOWED_ROLES:
						patch = { discord: { birthday: { allowedRolesIds: roleIds } } };
						section = 'birthday';
						confirmation = `✅ Rôles anniversaires : ${mentionRoles(roleIds)}`;
						break;
					default:
						return;
				}

				const config = await configService.patch(guildId, patch);
				const view = section === 'absence' ? await buildAbsenceView(config) : await buildBirthdayView(config);
				await interaction.update(view);
				await interaction.followUp({ content: confirmation, flags: MessageFlags.Ephemeral });
				return;
			}

			if (interaction.isModalSubmit() && interaction.customId === PLANNING_MODAL_ID) {
				const googleSheetId = interaction.fields.getTextInputValue(PLANNING_SHEET_ID_INPUT).trim();
				const sheetName = interaction.fields.getTextInputValue(PLANNING_SHEET_NAME_INPUT).trim();
				await configService.patch(guildId, {
					planning: { googleSheetId, sheetName },
				});
				const config = await configService.get(guildId);
				await interaction.reply({
					...(await buildHomeView(config)),
					content: '✅ Planning Google Sheets mis à jour !',
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			if (interaction.isModalSubmit() && interaction.customId === SCHEDULES_MODAL_ID) {
				const absenceWarnTimeRaw = interaction.fields.getTextInputValue(ABSENCE_WARN_TIME_INPUT).trim();
				const birthdayWarnTimeRaw = interaction.fields.getTextInputValue(BIRTHDAY_WARN_TIME_INPUT).trim();

				if (!DateUtils.parseHhMm(absenceWarnTimeRaw) || !DateUtils.parseHhMm(birthdayWarnTimeRaw)) {
					await interaction.reply({
						content: 'Format invalide. Utilise `HH:mm` (ex: `07:00` ou `8:30`). Les heures sont en Europe/Paris.',
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				const config = await configService.patch(guildId, {
					discord: {
						absence: { warnTime: absenceWarnTimeRaw },
						birthday: { warnTime: birthdayWarnTimeRaw },
					},
				});
				warnTasksScheduler.apply(config.discord.absence.warnTime, config.discord.birthday.warnTime);
				await interaction.reply({
					...(await buildHomeView(config)),
					content: `✅ Horaires mis à jour ! Absences \`${config.discord.absence.warnTime}\` · Anniversaires \`${config.discord.birthday.warnTime}\` (Europe/Paris)`,
					flags: MessageFlags.Ephemeral,
				});
			}
		} catch (error) {
			console.error('[Permanantes Config] interaction error:', {
				error,
				userId: interaction.user?.id,
				customId,
			});
			try {
				if (interaction.isRepliable()) {
					if (interaction.deferred || interaction.replied) {
						await interaction.followUp({ content: USER_ERROR_MESSAGE, flags: MessageFlags.Ephemeral });
					} else {
						await interaction.reply({ content: USER_ERROR_MESSAGE, flags: MessageFlags.Ephemeral });
					}
				}
			} catch {}
		}
	},
};
