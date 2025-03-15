import { Client, Events, TextChannel, ThreadChannel } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const MATERIAL_CHANNEL_ID = process.env.MATERIAL_CHANNEL_ID;
const QUESTIONS_CHANNEL_ID = process.env.QUESTIONS_CHANNEL_ID;

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

		try {
			// Get the questions channel
			const questionsChannel = await client.channels.fetch(QUESTIONS_CHANNEL_ID);
			if (!questionsChannel || !(questionsChannel instanceof TextChannel)) {
				console.error('Questions channel not found');
				return;
			}

			// Create a new thread in the questions forum
			const threadName = `${thread.name} / Q & R`;
			const newThread = await questionsChannel.threads.create({
				name: threadName,
				reason: 'Fil de discussion créé automatiquement pour un nouveau matériel',
			});

			await newThread.send(`${threadName} \n❔💬 Vos questions sur ce matériel : ${thread}`);
		} catch (error) {
			console.error('Error creating thread:', error);
		}
	});
};
