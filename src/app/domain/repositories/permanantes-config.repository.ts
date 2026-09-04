import { IPermanantesConfig } from '../entities/permanantes-config.entity';

export interface PermanantesConfigRepository {
	findByGuildId(guildId: string): Promise<IPermanantesConfig | null>;
	save(guildId: string, config: IPermanantesConfig): Promise<void>;
}
