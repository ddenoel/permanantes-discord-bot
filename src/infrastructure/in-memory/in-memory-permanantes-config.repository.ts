import { IPermanantesConfig, PermanantesConfig } from '../../app/domain/entities/permanantes-config.entity';
import { PermanantesConfigRepository } from '../../app/domain/repositories/permanantes-config.repository';

export class InMemoryPermanantesConfigRepository implements PermanantesConfigRepository {
	private store = new Map<string, IPermanantesConfig>();

	async findByGuildId(guildId: string): Promise<IPermanantesConfig | null> {
		const stored = this.store.get(guildId);
		return stored ? new PermanantesConfig(stored).withGuildId(guildId).toInterface() : null;
	}

	async save(guildId: string, config: IPermanantesConfig): Promise<void> {
		this.store.set(guildId, new PermanantesConfig(config).withGuildId(guildId).toInterface());
	}
}
