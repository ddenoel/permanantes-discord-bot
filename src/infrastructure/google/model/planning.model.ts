import { PlanningEventType, PlanningProject } from '../../../app/domain/entities/planning.entity';

export type GoogleSheetSeanceType =
	| 'Théâtre'
	| 'Chant'
	| 'Danse / Mise en corps'
	| 'Répétition générale'
	| 'A définir'
	| 'Autre';

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
	seanceType: GoogleSheetSeanceType;
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
	seanceType: GoogleSheetSeanceType;
};
