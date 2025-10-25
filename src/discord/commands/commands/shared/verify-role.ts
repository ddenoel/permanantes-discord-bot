import { ChatInputCommandInteraction } from 'discord.js';

export async function verifyRole(interaction: ChatInputCommandInteraction) {
	const allowedRoleId = process.env.ABSENCE_ALLOWED_ROLE_ID;
	if (allowedRoleId) {
		const member = await interaction.guild.members.fetch(interaction.user.id);
		if (!member.roles.cache.has(allowedRoleId)) {
			const role = interaction.guild.roles.cache.get(allowedRoleId);
			await interaction.editReply({
				content: `Vous n'avez pas le rôle ${role ? `<@&${role.id}>` : ''} requis pour utiliser cette commande.`,
			});

			return false;
		}
	}
	return true;
}
