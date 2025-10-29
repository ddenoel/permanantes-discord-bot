import {
	Client,
	Events,
	GatewayIntentBits,
	Collection,
	MessageFlags,
	InteractionType,
	StringSelectMenuInteraction,
} from 'discord.js';
import { config } from 'dotenv';
import { command as absenceCommand } from './commands/commands/absence';
import { command as getAbsencesCommand } from './commands/commands/get-absences-of-the-day';
import { command as getMyAbsencesCommand } from './commands/commands/get-my-absences';
import { command as deleteAbsenceCommand } from './commands/commands/delete-absence';
import { command as newBirthdayCommand } from './commands/commands/birthday/new-birthday';
import { Command } from './commands/command.model';
import { createThreadOnPost } from './automations';
import { deployCommands } from './commands/deploy-commands';

export default async function startDiscord() {
	// Load environment variables
	config();

	// Create a new client instance
	const client = new Client({
		intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
	});

	// Create a collection for commands
	const commands = new Collection<string, Command>();
	commands.set(absenceCommand.data.name, absenceCommand);
	commands.set(getAbsencesCommand.data.name, getAbsencesCommand);
	commands.set(getMyAbsencesCommand.data.name, getMyAbsencesCommand);
	commands.set(deleteAbsenceCommand.data.name, deleteAbsenceCommand);
	commands.set(newBirthdayCommand.data.name, newBirthdayCommand);

	// Set up automations
	createThreadOnPost(client);

	client.once(Events.ClientReady, (readyClient) => {
		console.log(`Ready! Logged in as ${readyClient.user.tag}`);
		deployCommands();
	});

	client.on(Events.InteractionCreate, async (interaction) => {
		if (interaction.isChatInputCommand()) {
			const command = commands.get(interaction.commandName);
			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}
			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(error);
				const errorMessage =
					"Une erreur est survenue lors de l'exécution de cette commande! Veuillez réessayer plus tard. Si le problème persiste, contactez Diane ou un administrateur.";
				try {
					if (interaction.deferred) {
						await interaction.editReply({ content: errorMessage });
					} else if (interaction.replied) {
						await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
					} else {
						await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
					}
				} catch (e) {
					console.error('[Global Handler] Failed to send error reply:', e);
				}
			}
			return;
		}

		for (const command of commands.values()) {
			if (command.handleCommandInteractions) {
				await command.handleCommandInteractions(interaction);
			}
		}
	});

	// Log in to Discord with your client's token
	client.login(process.env.DISCORD_TOKEN);

	return client;
}
