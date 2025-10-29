import { Client } from 'discord.js';
import { initializeFirebase } from '../infrastructure/firestore/firebase';

import { FirestoreAbsenceRepository } from '../infrastructure/firestore/firestore-absence.repository';
import { AbsenceRepository } from './domain/repositories/absence.repostiory';
import { CreateAbsence, CreateAbsencePayload } from './use-cases/create-absence';
import { InMemoryAbsenceRepository } from '../infrastructure/in-memory/in-memory-absence.repository';
import { Absence } from './domain/entities/absence.entity';
import { WarnAbsence } from './use-cases/warn-absence';
import cron from 'node-cron';
import { RetrieveAbsencesOfTheDay } from './use-cases/retrieve-absences-of-the-day';
import { RetrieveAbsencesOfUser } from './use-cases/retrieve-absences-of-user';
import { DeleteAbsence } from './use-cases/delete-absence';
import { RetrieveAbsenceById } from './use-cases/retrieve-absence-by-id';
import { RemindAbsences } from './use-cases/remind-absences';
import { DiscordService } from './domain/services/discord.service';
import { GoogleService } from '../infrastructure/google/google';
import { GoogleSheetAbsenceRepository } from '../infrastructure/google/sheet-absence.repository';
import { PlanningSheet } from '../infrastructure/google/planning-sheet';
import { PlanningRepository } from './domain/repositories/planning.repository';
import { FirestorePlanningRepository } from '../infrastructure/firestore/firestore-planning.repository';
import { InMemoryPlanningRepository } from '../infrastructure/in-memory/in-memory-planning.repository';
import { SyncPlanningFromGoogle } from './use-cases/sync-planning-from-google';
import { RetrieveFuturePlanningEntries } from './use-cases/retrieve-future-planning-entries';
import { BirthdayRepository } from './domain/repositories/birthday.repository';
import { FirestoreBirthdayRepository } from '../infrastructure/firestore/firestore-birthday.repository';
import { InMemoryBirthdayRepository } from '../infrastructure/in-memory/in-memory-birthday.repository';
import { CreateBirthday, CreateBirthdayPayload } from './use-cases/birthday/create-birthday';
import { RetrieveBirthdayByMember } from './use-cases/birthday/retrieve-birthday-by-member';
import { UpdateBirthdayDate } from './use-cases/birthday/update-birthday-date';
import { BirthdayApp } from './birthday.app';

let firebaseError = false;
try {
	initializeFirebase();
} catch (e) {
	console.error('Failed to initialize Firebase:', e);
	firebaseError = true;
}

export class App {
	private absenceRepo: AbsenceRepository = firebaseError
		? new InMemoryAbsenceRepository()
		: new FirestoreAbsenceRepository();
	private absenceRepoFallback: AbsenceRepository = new InMemoryAbsenceRepository();
	private planningRepo: PlanningRepository = firebaseError
		? new InMemoryPlanningRepository()
		: new FirestorePlanningRepository();

	createAbsence: CreateAbsence;
	private createAbsenceInGoogle: CreateAbsence;
	warnAbsence: WarnAbsence;
	private remindAbsences: RemindAbsences;
	private discordService: DiscordService;
	readonly retrieveFuturePlanningEntries: RetrieveFuturePlanningEntries;
	readonly retrieveAbsencesOfTheDay: RetrieveAbsencesOfTheDay;
	readonly retrieveAbsencesOfUser: RetrieveAbsencesOfUser;
	readonly deleteAbsence: DeleteAbsence;
	private deleteAbsenceInGoogle: DeleteAbsence;
	readonly retrieveAbsenceById: RetrieveAbsenceById;
	private googleService: GoogleService = new GoogleService();
	private planningSheet: PlanningSheet = new PlanningSheet(this.googleService);
	syncPlanning: SyncPlanningFromGoogle = new SyncPlanningFromGoogle(
		this.planningRepo,
		this.planningSheet,
		this.absenceRepo
	);
	readonly birthday: BirthdayApp;

	constructor(private discord: Client) {
		this.discordService = new DiscordService(this.discord);
		this.birthday = new BirthdayApp(firebaseError, this.discordService);
		this.warnAbsence = new WarnAbsence(this.discordService, this.absenceRepo);
		this.remindAbsences = new RemindAbsences(this.discordService);
		this.retrieveFuturePlanningEntries = new RetrieveFuturePlanningEntries(this.planningRepo, this.discordService);

		this.retrieveAbsencesOfTheDay = new RetrieveAbsencesOfTheDay(this.absenceRepo, this.discordService);
		this.retrieveAbsencesOfUser = new RetrieveAbsencesOfUser(this.absenceRepo, this.discordService);
		this.deleteAbsenceInGoogle = new DeleteAbsence(
			new GoogleSheetAbsenceRepository(this.googleService, new PlanningSheet(this.googleService)),
			this.discordService
		);
		this.retrieveAbsenceById = new RetrieveAbsenceById(this.absenceRepo, this.discordService);
		this.createAbsenceInGoogle = new CreateAbsence(
			new GoogleSheetAbsenceRepository(this.googleService, new PlanningSheet(this.googleService)),
			this.discordService,
			this.planningRepo
		);
		this.createAbsence = {
			execute: async (input: CreateAbsencePayload) => {
				const createAbsence = new CreateAbsence(this.absenceRepo, this.discordService, this.planningRepo);
				try {
					await this.createAbsenceInGoogle.execute(input);
				} catch (e) {
					console.error(`Error while creating absence in Google sheet: ${e}`, e);
				}

				let absence: Absence;
				try {
					absence = await createAbsence.execute(input);
				} catch (e) {
					console.error(`Error while creating absence in Firestore, falling back to in memory: ${e}`, e);
					const inMemoryCreateAbsence = new CreateAbsence(
						this.absenceRepoFallback,
						this.discordService,
						this.planningRepo
					);
					absence = await inMemoryCreateAbsence.execute(input);
				}

				return absence;
			},
		} as CreateAbsence;

		this.deleteAbsence = {
			execute: async (absence: Absence, deleteMessage = true) => {
				const deleteAbsence = new DeleteAbsence(this.absenceRepo, this.discordService);
				try {
					deleteAbsence.execute(absence, deleteMessage);
				} catch (e) {
					console.error(`Error while deleting absence in Firestore: ${e}`, e);
				}
				try {
					await this.deleteAbsenceInGoogle.execute(absence, false);
				} catch (e) {
					console.error(`Error while deleting absence in Google sheet: ${e}`, e);
				}
			},
		} as DeleteAbsence;
	}

	scheduleTasks() {
		const retrieveAbsenceOfTheDayFallback = new RetrieveAbsencesOfTheDay(this.absenceRepoFallback, this.discordService);
		// Schedule at 10:00(+2h) everyday
		cron.schedule('0 10 * * *', async () => {
			console.info('Checking absences of the day');
			let absences: Absence[] = [];
			try {
				absences.push(...(await this.retrieveAbsencesOfTheDay.execute()));
			} catch (e) {
				console.error(`Error while reminding absences: ${e}`);
			}

			absences.push(...(await retrieveAbsenceOfTheDayFallback.execute()));

			console.log(`${absences.length} absences found`);

			await this.remindAbsences.execute(absences);
		});

		// Schedule planning sync twice a week: Tuesday and Friday at 03:00(+2h)
		cron.schedule('0 3 * * 2,5', async () => {
			console.info('Syncing planning from Google Sheet');
			try {
				const res = await this.syncPlanning.execute();
				console.info(`Planning sync done: ${res.createdOrUpdated} upserts, ${res.deleted} deletions`);
			} catch (e) {
				console.error('Error during planning sync (primary repo). Falling back to in-memory.', e);
			}
		});

		this.birthday.scheduleTasks();
	}
}
