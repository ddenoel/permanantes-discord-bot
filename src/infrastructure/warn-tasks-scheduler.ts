import cron, { ScheduledTask } from 'node-cron';
import { DateUtils } from '../app/domain/utils/dates.utils';

type WarnRunner = () => Promise<void>;

const TIMEZONE = 'Europe/Paris';

/**
 * Singleton scheduler so Discord config updates can reschedule the long-lived warn jobs.
 */
class WarnTasksScheduler {
	private absenceTask: ScheduledTask | null = null;
	private birthdayTask: ScheduledTask | null = null;
	private absenceRunner: WarnRunner | null = null;
	private birthdayRunner: WarnRunner | null = null;

	setAbsenceRunner(runner: WarnRunner): void {
		this.absenceRunner = runner;
	}

	setBirthdayRunner(runner: WarnRunner): void {
		this.birthdayRunner = runner;
	}

	apply(absenceWarnTime?: string, birthdayWarnTime?: string): void {
		const absenceCron = DateUtils.toDailyCron(absenceWarnTime, DateUtils.DEFAULT_ABSENCE_WARN_TIME);
		const birthdayCron = DateUtils.toDailyCron(birthdayWarnTime, DateUtils.DEFAULT_BIRTHDAY_WARN_TIME);

		this.absenceTask?.stop();
		this.birthdayTask?.stop();
		this.absenceTask = null;
		this.birthdayTask = null;

		if (this.absenceRunner && cron.validate(absenceCron)) {
			this.absenceTask = cron.schedule(
				absenceCron,
				async () => {
					try {
						await this.absenceRunner!();
					} catch (e) {
						console.error('[WarnTasksScheduler] Absence warn failed:', e);
					}
				},
				{ timezone: TIMEZONE }
			);
			console.info(`[WarnTasksScheduler] Absence warn scheduled at ${DateUtils.normalizeHhMm(absenceWarnTime, DateUtils.DEFAULT_ABSENCE_WARN_TIME)} (${TIMEZONE})`);
		}

		if (this.birthdayRunner && cron.validate(birthdayCron)) {
			this.birthdayTask = cron.schedule(
				birthdayCron,
				async () => {
					try {
						await this.birthdayRunner!();
					} catch (e) {
						console.error('[WarnTasksScheduler] Birthday warn failed:', e);
					}
				},
				{ timezone: TIMEZONE }
			);
			console.info(`[WarnTasksScheduler] Birthday warn scheduled at ${DateUtils.normalizeHhMm(birthdayWarnTime, DateUtils.DEFAULT_BIRTHDAY_WARN_TIME)} (${TIMEZONE})`);
		}
	}
}

export const warnTasksScheduler = new WarnTasksScheduler();
