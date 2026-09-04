import { Client } from 'discord.js';

import { config } from 'dotenv';
import { PermanantesConfigService } from './permanantes-config.service';
import { PermanantesConfig } from '../entities/permanantes-config.entity';

config();

export class DiscordService {
	private CURR_GUILD_ID: string = process.env.GUILD_ID;

	constructor(
		private client: Client,
		private configService: PermanantesConfigService
	) {}

	get guildId() {
		return this.CURR_GUILD_ID;
	}

	verifyGuild(guildId: string): boolean {
		return guildId === this.guildId;
	}

	async getConfig(guildId?: string): Promise<PermanantesConfig> {
		return this.configService.get(guildId || this.guildId);
	}

	private async fetchConfiguredChannel(channelId: string, label: string) {
		if (!channelId) {
			throw new Error(`[DiscordService] Configuration error: ${label} is not set in Permanantes config`);
		}

		const channel = await this.client.channels.fetch(channelId);
		if (!channel) {
			throw new Error(`[DiscordService] Channel not found: Channel ID ${channelId} does not exist`);
		}
		return channel;
	}

	async getAbsenceChannel() {
		const cfg = await this.getConfig();
		return this.fetchConfiguredChannel(cfg.discord.absence.channelId, 'discord.absence.channelId');
	}

	async getBirthdayChannel() {
		const cfg = await this.getConfig();
		return this.fetchConfiguredChannel(cfg.discord.birthday.channelId, 'discord.birthday.channelId');
	}

	async getMaterialChannel() {
		const cfg = await this.getConfig();
		return this.fetchConfiguredChannel(cfg.discord.material.channelId, 'discord.material.channelId');
	}

	async getInformChannel() {
		const cfg = await this.getConfig();
		return this.fetchConfiguredChannel(cfg.discord.material.informChannelId, 'discord.material.informChannelId');
	}

	async memberHasAnyRole(memberId: string, roleIds?: string[]): Promise<boolean> {
		const allowed = (roleIds || []).map((s) => s.trim()).filter(Boolean);
		if (!allowed.length) return true;
		const guild = this.client.guilds.cache.get(this.guildId);
		if (!guild) return false;
		const member = await guild.members.fetch(memberId).catch(() => null);
		if (!member) return false;
		return allowed.some((id) => member.roles.cache.has(id));
	}
}
