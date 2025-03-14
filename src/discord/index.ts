import { Client, Events, GatewayIntentBits, Collection, MessageFlags } from 'discord.js';
import { config } from 'dotenv';
import { command as absenceCommand } from './commands/absence';
import { Command } from './command.model';

export default async function startDiscord() {
	// Load environment variables
	config();

	// Create a new client instance
	const client = new Client({
		intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
	});

	// Create a collection for commands
	const commands = new Collection<string, Command>();
	commands.set(absenceCommand.data.name, absenceCommand);

	client.once(Events.ClientReady, (readyClient) => {
		console.log(`Ready! Logged in as ${readyClient.user.tag}`);
	});

	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isChatInputCommand()) return;

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
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({
					content: errorMessage,
					flags: MessageFlags.Ephemeral,
				});
			} else {
				await interaction.reply({
					content: errorMessage,
					flags: MessageFlags.Ephemeral,
				});
			}
		}
	});

	// Log in to Discord with your client's token
	client.login(process.env.DISCORD_TOKEN);
}
