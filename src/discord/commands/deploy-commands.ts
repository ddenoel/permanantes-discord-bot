import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { command as absenceCommand } from './commands/absence';
import { command as getAbsencesCommand } from './commands/get-absences-of-the-day';
import { command as getMyAbsencesCommand } from './commands/get-my-absences';
import { command as deleteAbsenceCommand } from './commands/delete-absence';
import { command as newBirthdayCommand } from './commands/birthday/new-birthday';

config();

const commands = [
	absenceCommand.data.toJSON(),
	getAbsencesCommand.data.toJSON(),
	getMyAbsencesCommand.data.toJSON(),
	deleteAbsenceCommand.data.toJSON(),
	newBirthdayCommand.data.toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

export async function deployCommands() {
	try {
		console.log(
			`Started refreshing ${commands.length} application (/) commands (${commands.map((command) => command.name).join(', ')}).`
		);

		await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!), { body: commands });

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
}
