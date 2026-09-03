import { Channel, Client, EmbedBuilder, Events, TextChannel, ThreadChannel } from 'discord.js';
import { EMBED_COLOR } from '../../app/domain/data/style.data';
import { DiscordService } from '../../app/domain/services/discord.service';

export class WarnOnRessourcePost {
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
				throw new Error('[WarnOnRessourcePost] MATERIAL_CHANNEL_ID is not a forum channel');
			}
			// Check if the thread is created in the material channel
			if (thread.parentId !== channel.id) {
				return;
			}

			try {
				const informationChannel = await this.discordService.getInformChannel();
				const embed = new EmbedBuilder()
					.setColor(parseInt(EMBED_COLOR.replace('#', ''), 16))
					.setTitle('📣 Nouveau matériel disponible !');
				let message = `### ${thread.name}`;
				message += `\nGO GO GO ! C'est par ici 👉 ${thread}`;

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
