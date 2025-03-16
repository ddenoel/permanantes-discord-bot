import { Client, Message, TextChannel } from 'discord.js';
import * as schedule from 'node-schedule';
import { startOfDay, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AbsenceReminder {
	userId: string;
	date: Date;
	channelId: string;
	message: Message;
}

const scheduledReminders = new Map<string, AbsenceReminder>();

export function scheduleAbsenceReminder(client: Client, reminder: AbsenceReminder): void {
	const { userId, date, channelId, message } = reminder;
	const reminderKey = `${userId}-${date.getTime()}`;

	// Schedule for 16:00 (4:00 PM) on the given date
	const scheduledDate = startOfDay(date);
	scheduledDate.setHours(16, 0, 0, 0);

	schedule.scheduleJob(scheduledDate, async () => {
		try {
			const channel = await client.channels.fetch(channelId);
			if (!(channel instanceof TextChannel)) {
				console.error('[Absence Scheduler] Invalid channel type:', channelId);
				return;
			}

			const notifyRoleId: string = process.env.NOTIFY_ROLE_ID || '';
			const roleTag = notifyRoleId ? `<@&${notifyRoleId}>` : '';
			const formattedDate = format(date, 'dd MMMM yyyy', { locale: fr });

			await channel.send(`**Rappel** \n<@${userId}> n'est pas parmis nous aujourd'hui ! 😢 ${roleTag}\n${message}`);

			// Remove the reminder from the map after it's sent
			scheduledReminders.delete(reminderKey);
		} catch (error) {
			console.error('[Absence Scheduler] Failed to send reminder:', {
				error,
				userId,
				channelId,
				date,
			});
		}
	});

	scheduledReminders.set(reminderKey, reminder);
}

export function cancelScheduledReminders(userId: string): void {
	for (const [key, reminder] of scheduledReminders.entries()) {
		if (reminder.userId === userId) {
			schedule.cancelJob(key);
			scheduledReminders.delete(key);
		}
	}
}

export function getScheduledReminders(userId: string): AbsenceReminder[] {
	return Array.from(scheduledReminders.values()).filter((reminder) => reminder.userId === userId);
}
