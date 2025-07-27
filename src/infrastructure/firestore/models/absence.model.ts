import { IAbsenceEntity, IDiscordInfo } from '../../../app/domain/entities/absence.entity';
import { Collection } from 'fireorm';

@Collection('absences')
export class AbsenceModel implements IAbsenceEntity {
	id: string;
	discord: IDiscordInfo;
	absenceDate: Date;
	message?: string;
	createdAt: Date;
}
