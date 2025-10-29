import { GuildMember } from 'discord.js';

export class MemberUtils {
	static getDisplayName(member: GuildMember): string {
		return (
			member.displayName || member.nickname || member.user.displayName || member.user.globalName || member.user.username
		);
	}
}
