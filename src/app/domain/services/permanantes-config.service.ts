import { IPermanantesConfig, PermanantesConfig } from '../entities/permanantes-config.entity';
import { PermanantesConfigRepository } from '../repositories/permanantes-config.repository';
import { DateUtils } from '../utils/dates.utils';

export class PermanantesConfigService {
	private cache = new Map<string, { config: PermanantesConfig; at: number }>();
	private readonly cacheTtlMs = 30_000;

	constructor(private readonly repo: PermanantesConfigRepository) {}

	invalidate(guildId?: string): void {
		if (guildId) {
			this.cache.delete(guildId);
			return;
		}
		this.cache.clear();
	}

	async get(guildId: string): Promise<PermanantesConfig> {
		const cached = this.cache.get(guildId);
		if (cached && Date.now() - cached.at < this.cacheTtlMs) {
			return cached.config;
		}

		let stored = await this.repo.findByGuildId(guildId);
		if (!stored) {
			const seeded = PermanantesConfig.fromEnv(guildId);
			const hasAnyValue =
				!!seeded.discord.material.channelId ||
				!!seeded.discord.absence.channelId ||
				!!seeded.discord.birthday.channelId ||
				!!seeded.planning.googleSheetId;
			if (hasAnyValue) {
				await this.repo.save(guildId, seeded.toInterface());
				stored = seeded.toInterface();
			} else {
				stored = PermanantesConfig.empty(guildId).toInterface();
			}
		} else if (!stored.discord.guildId) {
			stored = new PermanantesConfig(stored).withGuildId(guildId).toInterface();
			await this.repo.save(guildId, stored);
		}

		const config = new PermanantesConfig(stored).withGuildId(guildId);
		this.cache.set(guildId, { config, at: Date.now() });
		return config;
	}

	async save(guildId: string, config: IPermanantesConfig | PermanantesConfig): Promise<PermanantesConfig> {
		const entity = (config instanceof PermanantesConfig ? config : new PermanantesConfig(config)).withGuildId(guildId);
		await this.repo.save(guildId, entity.toInterface());
		this.cache.set(guildId, { config: entity, at: Date.now() });
		return entity;
	}

	async patch(guildId: string, patch: DeepPartialConfig): Promise<PermanantesConfig> {
		const current = await this.get(guildId);
		const merged = new PermanantesConfig({
			discord: {
				guildId,
				material: {
					channelId: patch.discord?.material?.channelId ?? current.discord.material.channelId,
					informChannelId: patch.discord?.material?.informChannelId ?? current.discord.material.informChannelId,
				},
				absence: {
					channelId: patch.discord?.absence?.channelId ?? current.discord.absence.channelId,
					roleToNotifyId: patch.discord?.absence?.roleToNotifyId ?? current.discord.absence.roleToNotifyId,
					allowedRolesIds: patch.discord?.absence?.allowedRolesIds ?? current.discord.absence.allowedRolesIds,
					warnTime: DateUtils.normalizeHhMm(
						patch.discord?.absence?.warnTime ?? current.discord.absence.warnTime,
						DateUtils.DEFAULT_ABSENCE_WARN_TIME
					),
				},
				birthday: {
					channelId: patch.discord?.birthday?.channelId ?? current.discord.birthday.channelId,
					allowedRolesIds: patch.discord?.birthday?.allowedRolesIds ?? current.discord.birthday.allowedRolesIds,
					warnTime: DateUtils.normalizeHhMm(
						patch.discord?.birthday?.warnTime ?? current.discord.birthday.warnTime,
						DateUtils.DEFAULT_BIRTHDAY_WARN_TIME
					),
				},
			},
			planning: {
				googleSheetId: patch.planning?.googleSheetId ?? current.planning.googleSheetId,
				sheetName: patch.planning?.sheetName ?? current.planning.sheetName,
			},
		});
		return this.save(guildId, merged);
	}
}

export type DeepPartialConfig = {
	discord?: {
		guildId?: string;
		material?: Partial<{ channelId: string; informChannelId: string }>;
		absence?: Partial<{ channelId: string; roleToNotifyId: string; allowedRolesIds: string[]; warnTime: string }>;
		birthday?: Partial<{ channelId: string; allowedRolesIds: string[]; warnTime: string }>;
	};
	planning?: Partial<{ googleSheetId: string; sheetName: string }>;
};
