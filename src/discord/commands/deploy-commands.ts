import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { command as absenceCommand } from './commands/absence';

config();

const commands = [absenceCommand.data.toJSON()];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

// Replace 'YOUR_CLIENT_ID' and 'YOUR_GUILD_ID' with your bot's client ID and guild ID
async function deployCommands() {
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!), { body: commands });

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
}

deployCommands();
