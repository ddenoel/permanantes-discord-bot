import { PlanningEventType, PlanningProject } from '../../../app/domain/entities/planning.entity';

export interface IGoogleSheetPlanningEntry {
	column: string;
	/** Month in French in full format (ex: "Septembre") */
	month: string;
	/** Date in French in format <Day of week> <Day of month> */
	date: string;
	/** Date in full format (ex: "<Day of week> dd/mm/yyyy") */
	dateFull: string;
	whereAndWhen: string;
	what: string;
	absents: string;
	other: string;
	project: PlanningProject;
}

export type IGoogleSheetPlanningEntryEntity = {
	date: Date;
	startDateTime?: Date;
	endDateTime?: Date;
	location: {
		name: string;
	};
	type: PlanningEventType;
	what: string;
	absents: string[];
	otherInfos?: string;
	project: PlanningProject;
};
