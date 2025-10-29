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
			const emoji = monthEmojiByIndex[date.getMonth()] || '📅';
			const iso = date.toISOString();
			let labelBase = `${DateUtils.formatDateWithWeekday(date)}`;
			if (DateUtils.isSameDay(date, new Date())) labelBase = `Aujourd'hui (${labelBase})`;
			const already = disabledIsoValues.has(iso);
			const description =
				(e.what ? `Thème : ${e.what}` : '') + (already ? ' (Vous êtes déjà absent ce jour)' : '') || '\u200B';
			return new StringSelectMenuOptionBuilder()
				.setLabel(labelBase)
				.setEmoji(already ? '❌' : emoji)
				.setDescription(description)
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
