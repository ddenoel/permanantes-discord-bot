import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Interaction,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from 'discord.js';
import { IPlanningEntryEntity } from '../../../app/domain/entities/planning.entity';
import { DateUtils } from '../../../app/domain/utils/dates.utils';
import { monthEmojiByIndex } from '../../../app/domain/data/dates.data';
import { MiscellaneousUtils } from '../../../app/domain/utils/miscellaneous.utils';
import { ACTIVITY_TYPE_EMOJI } from '../../../app/domain/data/planning.data';

export type PlanningSelectOptions = {
	customIds: { select: string; prev: string; next: string };
	pageIndex?: number;
	pageSize?: number;
	disabledIsoValues?: Set<string>;
	manualDateButton?: ButtonBuilder;
};

export function getPlanningEntriesAsSelect(
	interaction: Interaction,
	entries: IPlanningEntryEntity[],
	options: PlanningSelectOptions
) {
	let pageIndex = options.pageIndex ?? 0;
	const pageSize = options.pageSize ?? 25;
	const disabledIsoValues = options.disabledIsoValues ?? new Set<string>();

	const buildComponents = () => {
		const start = pageIndex * pageSize;
		const slice = entries.slice(start, start + pageSize);

		const selectOptions = slice.map((e) => {
			const date = e.date;
			const activityTypeEmoji = e.seanceType ? ACTIVITY_TYPE_EMOJI[e.seanceType] : null;
			const emoji = activityTypeEmoji || monthEmojiByIndex[date.getMonth()] || '📅';
			const iso = date.toISOString();
			let labelBase = `${DateUtils.formatDateWithWeekday(date)}`;
			if (DateUtils.isSameDay(date, new Date())) labelBase = `Aujourd'hui (${labelBase})`;
			const already = disabledIsoValues.has(iso);
			const alreadyAbsentMessage = '(Vous êtes déjà absent ce jour)';
			const DISCORD_MAX_CHARS_DESCRIPTION = 99;
			const maxCharsDescription = already
				? DISCORD_MAX_CHARS_DESCRIPTION - alreadyAbsentMessage.length - 3
				: DISCORD_MAX_CHARS_DESCRIPTION - 3;
			const baseDescription = e.what ? `Thème : ${e.what}` : '\u200B';
			const trimmedDescription = MiscellaneousUtils.truncateString(baseDescription, maxCharsDescription);
			const description = trimmedDescription + (already ? alreadyAbsentMessage : '');
			// Final safety clamp: Discord enforces option descriptions <= 100 chars
			const finalDescription =
				description.length > DISCORD_MAX_CHARS_DESCRIPTION
					? MiscellaneousUtils.truncateString(description, DISCORD_MAX_CHARS_DESCRIPTION - 3)
					: description;
			return new StringSelectMenuOptionBuilder()
				.setLabel(labelBase)
				.setEmoji(already ? '❌' : emoji)
				.setDescription(finalDescription)
				.setValue(iso);
		});

		if (!selectOptions.length) {
			selectOptions.push(
				new StringSelectMenuOptionBuilder().setLabel('Aucune date').setDescription('\u200B').setValue('none')
			);
		}

		const select = new StringSelectMenuBuilder()
			.setCustomId(options.customIds.select)
			.setPlaceholder('Choisissez une date de répétition')
			.addOptions(selectOptions);

		const rows: Array<ActionRowBuilder<any>> = [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)];

		const controls = new ActionRowBuilder<ButtonBuilder>();
		if (entries.length > pageSize) {
			controls.addComponents(
				new ButtonBuilder()
					.setCustomId(options.customIds.prev)
					.setLabel('⬅️🗓️ Dates précédentes')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(pageIndex === 0),
				new ButtonBuilder()
					.setCustomId(options.customIds.next)
					.setLabel('Dates suivantes 🗓️➡️')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled((pageIndex + 1) * pageSize >= entries.length)
			);
		}
		if (options.manualDateButton) controls.addComponents(options.manualDateButton);
		rows.push(controls);

		return rows;
	};

	const handleInteraction = async (i: Interaction) => {
		if (!i.isButton()) return;
		if (i.customId === options.customIds.next) {
			pageIndex = Math.min(pageIndex + 1, Math.ceil(entries.length / pageSize) - 1);
		} else if (i.customId === options.customIds.prev) {
			pageIndex = Math.max(pageIndex - 1, 0);
		} else {
			return;
		}
		await (i as any).update?.({ components: buildComponents() });
	};

	return { components: buildComponents(), handleInteraction };
}
