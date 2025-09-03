import { IPlanningEntryEntity } from '../../../app/domain/entities/planning.entity';

export interface IGoogleSheetPlanningEntry {
	column: string;
	/** Month in French in full format (ex: "Septembre") */
	month: string;
	/** Date in French in format <Day of week> <Day of month> */
	date: string;
	whereAndWhen: string;
	what: string;
	absents: string;
	other: string;
}

export type IGoogleSheetPlanningEntryEntity = Omit<IPlanningEntryEntity, 'absents'> & {
	absents: string[];
};
