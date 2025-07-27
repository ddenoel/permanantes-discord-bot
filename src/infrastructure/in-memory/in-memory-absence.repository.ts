import { AbsenceRepository } from '../../app/domain/repositories/absence.repostiory';
import { Absence } from '../../app/domain/entities/absence.entity';

const absencesByDate = new Map<number, Absence[]>();

export class InMemoryAbsenceRepository implements AbsenceRepository {
	findByDateAndGuild(date: Date, guildId: string): Promise<Absence[]> {
		return Promise.resolve(absencesByDate.get(date.getTime())?.filter((a) => a.discord.guildId === guildId) || []);
	}

	async save(absence: Absence): Promise<void> {
		const time = absence.absenceDate.getTime();
		if (!absencesByDate.has(time)) {
			absencesByDate.set(time, []);
		}
		absencesByDate.get(time)?.push(absence);
	}
}
