import { FirestoreBirthdayRepository } from '../infrastructure/firestore/firestore-birthday.repository';
import { InMemoryBirthdayRepository } from '../infrastructure/in-memory/in-memory-birthday.repository';
import { BirthdayRepository } from './domain/repositories/birthday.repository';
import { DiscordService } from './domain/services/discord.service';
import { CreateBirthday } from './use-cases/birthday/create-birthday';
import { RetrieveBirthdayByMember } from './use-cases/birthday/retrieve-birthday-by-member';
import { UpdateBirthdayDate } from './use-cases/birthday/update-birthday-date';
import { WarnBirthday } from './use-cases/birthday/warn-birthday';
import cron from 'node-cron';

export class BirthdayApp {
	private birthdayRepo: BirthdayRepository;

	readonly createBirthday: CreateBirthday;
	readonly retrieveBirthdayByMember: RetrieveBirthdayByMember;
	readonly updateBirthdayDate: UpdateBirthdayDate;
	readonly warnBirthday: WarnBirthday;

	constructor(
		private readonly firebaseError: boolean,
		discordService: DiscordService
	) {
		this.birthdayRepo = this.firebaseError ? new InMemoryBirthdayRepository() : new FirestoreBirthdayRepository();

		this.createBirthday = new CreateBirthday(this.birthdayRepo, discordService);
		this.retrieveBirthdayByMember = new RetrieveBirthdayByMember(this.birthdayRepo, discordService);
		this.updateBirthdayDate = new UpdateBirthdayDate(this.birthdayRepo, discordService);
		this.warnBirthday = new WarnBirthday(discordService, this.birthdayRepo);
	}

	scheduleTasks() {
		// Schedule birthdays at 8:00(+2h) everyday
		cron.schedule('0 8 * * *', async () => {
			console.info('Checking birthdays of the day');
			try {
				await this.warnBirthday.execute();
			} catch (e) {
				console.error('Error while warning birthdays:', e);
			}
		});
	}
}
