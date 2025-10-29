import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';

export async function verifyRole(interaction: ChatInputCommandInteraction, rolesCsv?: string, memberId?: string) {
	const allowedRoles = (rolesCsv || '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);

	if (!allowedRoles.length) return true;

	const member = await interaction.guild.members.fetch(memberId || interaction.user.id);
	const ok = allowedRoles.some((roleId) => member.roles.cache.has(roleId));
	if (!ok) {
		const mentions = allowedRoles
			.map((id) => interaction.guild.roles.cache.get(id))
			.filter(Boolean)
			.map((role) => `<@&${(role as any).id}>`)
			.join(', ');
		const content = `${memberId ? `<@${memberId}> n'a pas` : "Vous n'avez"} pas ${
			allowedRoles?.length > 1 ? 'les rôles' : 'le rôle'
		} ${mentions || ''} requis pour utiliser cette commande.`;
		if (interaction.deferred || interaction.replied) {
			await interaction.editReply({ content });
		} else {
			await interaction.reply({ content, flags: MessageFlags.Ephemeral });
		}
		return false;
	}

	return true;
}
