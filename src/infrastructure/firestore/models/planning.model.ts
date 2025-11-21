import { Collection } from 'fireorm';
import {
	ActivityType,
	IPlanningDiscordInfo,
	IPlanningEntryEntity,
	PlanningEventType,
	PlanningProject,
} from '../../../app/domain/entities/planning.entity';

type LocationModel = {
	name: string;
};

@Collection('planning')
export class PlanningModel implements Omit<IPlanningEntryEntity, 'absences'> {
	id: string;
	date: Date;
	startDateTime?: Date | null;
	endDateTime?: Date | null;
	location: LocationModel;
	type: PlanningEventType;
	what: string;
	otherInfos?: string;
	/**
	 * References to absence IDs (relations) stored separately in absences collection.
	 */
	absenceIds?: string[];
	/**
	 * Raw names parsed from Google Sheet.
	 */
	absentsNames?: string[];

	/**
	 * Timestamp of the last successful sync run.
	 */
	lastSyncAt?: Date;
	lastSyncKey: string; // yyyy-MM-dd
	project: PlanningProject;
	discord: IPlanningDiscordInfo;
	seanceType: ActivityType;
}
