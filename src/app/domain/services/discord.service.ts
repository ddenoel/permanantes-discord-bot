import { Client } from 'discord.js';
import { Absence } from '../entities/absence.entity';

import { config } from 'dotenv';

config();

export class DiscordService {
	private CURR_GUILD_ID: string = process.env.GUILD_ID;

	constructor(private client: Client) {}

	get guildId() {
		return this.CURR_GUILD_ID;
	}

	verifyGuild(guildId: string): boolean {
		return guildId === this.guildId;
	}

	async getAbsenceChannel() {
		const channelId = process.env.ABSENCE_CHANNEL_ID;
		if (!channelId) {
			throw new Error('[DiscordService] Configuration error: ABSENCE_CHANNEL_ID not set in environment variables');
		}

		const channel = await this.client.channels.fetch(channelId);
		if (!channel) {
			throw new Error(`[DiscordService] Channel not found: Channel ID ${channelId} does not exist`);
		}
		return channel;
	}

	async getBirthdayChannel() {
		const channelId = process.env.BIRTHDAY_CHANNEL_ID;
		if (!channelId) {
			throw new Error('[DiscordService] Configuration error: BIRTHDAY_CHANNEL_ID not set in environment variables');
		}

		const channel = await this.client.channels.fetch(channelId);
		if (!channel) {
			throw new Error(`[DiscordService] Channel not found: Channel ID ${channelId} does not exist`);
		}

		return channel;
	}

	async memberHasAnyRole(memberId: string, rolesCsv?: string): Promise<boolean> {
		const allowed = (rolesCsv || '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		if (!allowed.length) return true;
		const guild = this.client.guilds.cache.get(this.guildId);
		if (!guild) return false;
		const member = await guild.members.fetch(memberId).catch(() => null);
		if (!member) return false;
		return allowed.some((id) => member.roles.cache.has(id));
	}
}
