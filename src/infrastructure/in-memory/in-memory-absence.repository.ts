import { AbsenceRepository } from '../../app/domain/repositories/absence.repostiory';
import { Absence } from '../../app/domain/entities/absence.entity';

const absencesByDate = new Map<number, Absence[]>();

export class InMemoryAbsenceRepository implements AbsenceRepository {
	findByDateAndGuild(date: Date, guildId: string): Promise<Absence[]> {
		return Promise.resolve(absencesByDate.get(date.getTime())?.filter((a) => a.discord.guildId === guildId) || []);
	}

	findByUserAndGuildSince(userId: string, guildId: string, since: Date): Promise<Absence[]> {
		const results: Absence[] = [];
		for (const [time, absences] of absencesByDate.entries()) {
			if (time < since.getTime()) continue;
			for (const absence of absences) {
				if (absence.discord.guildId === guildId && absence.discord.member.id === userId) {
					results.push(absence);
				}
			}
		}
		return Promise.resolve(results);
	}

	async save(absence: Absence): Promise<void> {
		const time = absence.absenceDate.getTime();
		if (!absencesByDate.has(time)) {
			absencesByDate.set(time, []);
		}
		absencesByDate.get(time)?.push(absence);
	}
}
