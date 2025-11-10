import { Channel, Client, EmbedBuilder, Events, TextChannel, ThreadChannel } from 'discord.js';
import { EMBED_COLOR } from '../../app/domain/data/style.data';
import { DiscordService } from '../../app/domain/services/discord.service';

export class CreateQuestionThreadOnRessourcePost {
	private discordService: DiscordService;

	constructor(private readonly client: Client) {
		this.discordService = new DiscordService(this.client);
	}

	async automate(): Promise<void> {
		this.client.on(Events.ThreadCreate, async (thread: ThreadChannel) => {
			let channel: Channel | null = null;
			try {
				channel = await this.discordService.getMaterialChannel();
			} catch (error) {
				console.error('Error while getting material channel:', error);
				return;
			}
			if (!channel) {
				throw new Error('[CreateQuestionThreadOnRessourcePost] MATERIAL_CHANNEL_ID is not a forum channel');
			}
			// Check if the thread is created in the material channel
			if (thread.parentId !== channel.id) {
				return;
			}

			let questionsThread: ThreadChannel | null = null;
			try {
				// Get the questions channel
				const questionsChannel = await this.discordService.getQuestionsChannel();
				if (!questionsChannel || !(questionsChannel instanceof TextChannel)) {
					console.error('Questions channel not found');
					return;
				}

				// Create a new thread in the questions forum
				const threadName = `${thread.name} / Q & R`;
				questionsThread = await questionsChannel.threads.create({
					name: threadName,
					reason: 'Fil de discussion créé automatiquement pour un nouveau matériel',
				});

				await questionsThread.send(`${threadName} \n❔💬❓ Vos questions sur ce matériel : ${thread}`);
			} catch (error) {
				console.error('Error creating thread:', error);
			}

			try {
				const informationChannel = await this.discordService.getInformChannel();
				const embed = new EmbedBuilder()
					.setColor(parseInt(EMBED_COLOR.replace('#', ''), 16))
					.setTitle('📣 Nouveau matériel disponible !');
				let message = `### ${thread.name}`;
				message += `\nGO GO GO ! C'est par ici 👉 ${thread}`;
				if (questionsThread) {
					message += '\n\n---\n\n';
					message += `💬❓ Pour poser vos **questions**, c'est par ici 👉 ${questionsThread}`;
				}
				embed.setDescription(message);
				if (!(informationChannel instanceof TextChannel)) {
					return;
				}
				await informationChannel.send({ content: '@everyone', embeds: [embed] });
			} catch (error) {
				console.error('Error fetching information channel:', error);
			}
		});
	}
}
