import { SlashCommandBuilder, ChatInputCommandInteraction, Interaction } from 'discord.js';

export interface Command {
	data: SlashCommandBuilder;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
	handleCommandInteractions?: (interaction: Interaction) => Promise<void>;
}
