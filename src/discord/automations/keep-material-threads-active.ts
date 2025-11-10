import { Channel, ChannelType, Client, ForumChannel, TextChannel, ThreadChannel } from 'discord.js';
import cron from 'node-cron';
import { DiscordService } from '../../app/domain/services/discord.service';

export class KeepMaterialThreadsActive {
	private discordService: DiscordService;

	constructor(private readonly client: Client) {
		this.discordService = new DiscordService(this.client);
	}

	private async computeLastActivityTs(thread: ThreadChannel): Promise<number> {
		// Try the last message id first (cheap), then fetch last message if needed
		try {
			if (thread.lastMessageId) {
				const last = await thread.messages.fetch(thread.lastMessageId).catch(() => null);
				if (last?.createdTimestamp) return last.createdTimestamp;
			}
		} catch {
			// ignore
		}
		try {
			const lastCol = await thread.messages.fetch({ limit: 1 }).catch(() => null);
			const last = lastCol?.first();
			if (last?.createdTimestamp) return last.createdTimestamp;
		} catch {
			// ignore
		}
		// Fallbacks
		return (
			(thread as any).lastMessage?.createdTimestamp ||
			(thread as any).archiveTimestamp ||
			thread.createdTimestamp ||
			Date.now()
		);
	}

	private async touchThread(thread: ThreadChannel): Promise<void> {
		// First attempt: re-set the same autoArchiveDuration (least intrusive)
		try {
			const duration = thread.autoArchiveDuration ?? 4320; // keep current or default 3 days
			await thread.setAutoArchiveDuration(duration, 'Keep alive (maintenance)');

			return;
		} catch (e) {
			// Fallback below
		}
		// Fallback: toggle archive state to reset timer without leaving a message
		try {
			await thread.setArchived(true, 'Keep alive (maintenance)');
			await thread.setArchived(false, 'Keep alive (maintenance)');
		} catch {
			// Best-effort; swallow to continue other threads
		}
	}

	private async execute(): Promise<void> {
		let channel: Channel | null = null;
		try {
			channel = await this.discordService.getMaterialChannel();
		} catch (e) {
			console.error('Error while getting material channel:', e);
			return;
		}

		if (!channel || channel.type !== ChannelType.GuildForum) {
			throw new Error('[KeepMaterialThreadsActive] MATERIAL_CHANNEL_ID is not a forum channel');
		}

		const forum = channel as ForumChannel;
		const fetched = await forum.threads.fetchActive().catch(() => null);
		const threads: ThreadChannel[] = fetched ? (Array.from(fetched.threads.values()) as ThreadChannel[]) : [];
		if (!threads.length) return;

		// Sort by last activity ASC (oldest first) so that after updates, global order is preserved
		const withTs = await Promise.all(
			threads.map(async (t: ThreadChannel) => ({ thread: t, ts: await this.computeLastActivityTs(t) }))
		);
		withTs.sort((a, b) => a.ts - b.ts);

		for (const { thread } of withTs) {
			await this.touchThread(thread);
			// Small delay to avoid rate limiting and keep consistent ordering
			await new Promise((r) => setTimeout(r, 400));
		}
	}

	automate() {
		// Schedule material threads keep-alive every 2 days at 03:00(+2h)
		cron.schedule('0 3 */2 * *', async () => {
			console.info('Keeping material forum threads active (every 2 days)');
			try {
				await this.execute();
				console.info('Material forum threads updated successfully');
			} catch (e) {
				console.error('Error while keeping material threads active:', e);
			}
		});
	}
}
