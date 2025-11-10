import { Client, EmbedBuilder, Events, TextChannel, ThreadChannel } from 'discord.js';
import dotenv from 'dotenv';
import { EMBED_COLOR } from '../../app/domain/data/style.data';

dotenv.config();

const MATERIAL_CHANNEL_ID = process.env.MATERIAL_CHANNEL_ID;
const QUESTIONS_CHANNEL_ID = process.env.QUESTIONS_CHANNEL_ID;
const INFORM_CHANNEL_ID = process.env.INFORM_CHANNEL_ID;

export const createThreadOnPost = (client: Client): void => {
	if (!MATERIAL_CHANNEL_ID || !QUESTIONS_CHANNEL_ID) {
		console.error('Missing required channel IDs in environment variables');
		return;
	}

	client.on(Events.ThreadCreate, async (thread: ThreadChannel) => {
		// Check if the thread is created in the material channel
		if (thread.parentId !== MATERIAL_CHANNEL_ID) {
			return;
		}

		let questionsThread: ThreadChannel | null = null;
		try {
			// Get the questions channel
			const questionsChannel = await client.channels.fetch(QUESTIONS_CHANNEL_ID);
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

		if (!INFORM_CHANNEL_ID) {
			console.error('Missing required channel IDs (INFORM_CHANNEL_ID) in environment variables');
			return;
		}
		try {
			const informationChannel = await client.channels.fetch(INFORM_CHANNEL_ID);
			if (!informationChannel) {
				throw new Error(`Information channel not found with id ${INFORM_CHANNEL_ID}`);
			}
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
};
