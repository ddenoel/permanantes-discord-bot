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

	createAbsence: CreateAbsence;
	private createAbsenceInGoogle: CreateAbsence;
	warnAbsence: WarnAbsence;
	private remindAbsences: RemindAbsences;
	private discordService: DiscordService;
	readonly retrieveAbsencesOfTheDay: RetrieveAbsencesOfTheDay;
	readonly retrieveAbsencesOfUser: RetrieveAbsencesOfUser;
	readonly deleteAbsence: DeleteAbsence;
	private deleteAbsenceInGoogle: DeleteAbsence;
	readonly retrieveAbsenceById: RetrieveAbsenceById;
	private googleService: GoogleService = new GoogleService();

	constructor(private discord: Client) {
		this.discordService = new DiscordService(this.discord);
		this.warnAbsence = new WarnAbsence(this.discordService, this.absenceRepo);
		this.remindAbsences = new RemindAbsences(this.discordService);

		this.retrieveAbsencesOfTheDay = new RetrieveAbsencesOfTheDay(this.absenceRepo, this.discordService);
		this.retrieveAbsencesOfUser = new RetrieveAbsencesOfUser(this.absenceRepo, this.discordService);
		this.deleteAbsenceInGoogle = new DeleteAbsence(
			new GoogleSheetAbsenceRepository(this.googleService, new PlanningSheet(this.googleService)),
			this.discordService
		);
		this.retrieveAbsenceById = new RetrieveAbsenceById(this.absenceRepo, this.discordService);
		this.createAbsenceInGoogle = new CreateAbsence(
			new GoogleSheetAbsenceRepository(this.googleService, new PlanningSheet(this.googleService)),
			this.discordService
		);
		this.createAbsence = {
			execute: async (input: CreateAbsencePayload) => {
				const createAbsence = new CreateAbsence(this.absenceRepo, this.discordService);
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
					const inMemoryCreateAbsence = new CreateAbsence(this.absenceRepoFallback, this.discordService);
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
	}
}
