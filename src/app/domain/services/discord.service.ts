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
}
