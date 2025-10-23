import { IAbsenceEntity } from '../entities/absence.entity';

export interface AbsenceRepository {
	findByDateAndGuild(date: Date, guildId: string): Promise<IAbsenceEntity[]>;
	findByUserAndGuildSince(userId: string, guildId: string, since: Date, userName?: string): Promise<IAbsenceEntity[]>;
	findById(absenceId: string): Promise<IAbsenceEntity | null>;
	setDiscordMessageId(absenceId: string, messageId: string): Promise<void>;
	delete(absence: IAbsenceEntity): Promise<void>;
	save(absence: IAbsenceEntity): Promise<void>;
}
