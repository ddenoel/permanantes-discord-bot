import { IAbsenceEntity } from './absence.entity';

export type PlanningEventType = 'unknown' | 'rehearsal' | 'show' | 'workshop' | 'off';

export interface IPlanningEntryEntity {
	date: Date;
	startDateTime: Date;
	endDateTime: Date;
	location: {
		name: string;
	};
	type: PlanningEventType;
	what: string;
	absents: IAbsenceEntity[];
	otherInfos?: string;
}
