import { TextChannel } from 'discord.js';
import { config } from 'dotenv';
import { DiscordService } from '../../domain/services/discord.service';
import { Birthday } from '../../domain/entities/birthday.entity';
import { BirthdayRepository } from '../../domain/repositories/birthday.repository';

config();

export class WarnBirthday {
	constructor(
		private readonly discordService: DiscordService,
		private readonly repo: BirthdayRepository
	) {}

	async execute(): Promise<void> {
		const today = new Date();
		const month = today.getMonth() + 1;
		const day = today.getDate();
		const guildId = this.discordService.guildId;

		let birthdays: Birthday[] = [];
		try {
			birthdays = await this.repo.findByDayAndGuild(month, day, guildId);
		} catch (e) {
			console.error('[WarnBirthday] Failed to query birthdays of the day', e);
			return;
		}

		if (!birthdays.length) return;

		const allowedRoles = (await this.discordService.getConfig()).discord.birthday.allowedRolesIds;
		const eligible: Birthday[] = [];
		for (const b of birthdays) {
			try {
				if (await this.discordService.memberHasAnyRole(b.member.id, allowedRoles)) eligible.push(b);
			} catch (e) {
				console.warn('[WarnBirthday] Could not verify roles for member', b.member.id, e);
			}
		}

		if (!eligible.length) return;

		const channel = await this.discordService.getBirthdayChannel();
		if (!(channel instanceof TextChannel)) {
			throw new Error('[WarnBirthday] Invalid channel type');
		}

		const mentions = eligible.map((b) => `<@${b.member.id}>`).join(', ');
		const titleNames = eligible
			.map((b) => b.member.displayName || '')
			.filter(Boolean)
			.join(', ');
		const messageText = `🥳 Aujourd'hui on fête l'anniversaire de ${mentions} !\n Sortez les paillettes, les confettis et les vocalises ! 🎂🎈 (Et le gâteaaaaaaaaau ! 🎂🍰🧁🥮)`;

		let message;
		try {
			message = await channel.send({ content: messageText });
		} catch (e) {
			console.error('[WarnBirthday] Failed to send birthday message', e);
			return;
		}

		try {
			await message.startThread({
				name: `🎂 Anniversaire de ${titleNames || 'nos étoiles'}`,
				autoArchiveDuration: 4320,
			});
		} catch (e) {
			console.error('[WarnBirthday] Failed to create thread', e);
		}
	}
}
