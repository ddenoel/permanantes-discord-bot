import { IAbsenceEntity } from '../entities/absence.entity';

export interface AbsenceRepository {
	findByDateAndGuild(date: Date, guildId: string): Promise<IAbsenceEntity[]>;
	save(absence: IAbsenceEntity): Promise<void>;
}
