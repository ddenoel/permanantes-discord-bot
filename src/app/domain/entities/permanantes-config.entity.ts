export interface MaterialConfig {
	channelId: string;
	informChannelId: string;
}

export interface AbsenceConfig {
	channelId: string;
	roleToNotifyId: string;
	allowedRolesIds: string[];
	/** Daily warn time in Europe/Paris, format HH:mm */
	warnTime: string;
}

export interface BirthdayConfig {
	channelId: string;
	allowedRolesIds: string[];
	/** Daily warn time in Europe/Paris, format HH:mm */
	warnTime: string;
}

export interface DiscordConfig {
	guildId: string;
	material: MaterialConfig;
	absence: AbsenceConfig;
	birthday: BirthdayConfig;
}

export interface PlanningConfig {
	googleSheetId: string;
	sheetName: string;
}

export interface IPermanantesConfig {
	discord: DiscordConfig;
	planning: PlanningConfig;
}

const DEFAULT_ABSENCE_WARN_TIME = '07:00';
const DEFAULT_BIRTHDAY_WARN_TIME = '08:00';

export class PermanantesConfig implements IPermanantesConfig {
	discord: DiscordConfig;
	planning: PlanningConfig;

	constructor(data?: Partial<IPermanantesConfig>) {
		this.discord = {
			guildId: data?.discord?.guildId || '',
			material: {
				channelId: data?.discord?.material?.channelId || '',
				informChannelId: data?.discord?.material?.informChannelId || '',
			},
			absence: {
				channelId: data?.discord?.absence?.channelId || '',
				roleToNotifyId: data?.discord?.absence?.roleToNotifyId || '',
				allowedRolesIds: data?.discord?.absence?.allowedRolesIds || [],
				warnTime: data?.discord?.absence?.warnTime || DEFAULT_ABSENCE_WARN_TIME,
			},
			birthday: {
				channelId: data?.discord?.birthday?.channelId || '',
				allowedRolesIds: data?.discord?.birthday?.allowedRolesIds || [],
				warnTime: data?.discord?.birthday?.warnTime || DEFAULT_BIRTHDAY_WARN_TIME,
			},
		};
		this.planning = {
			googleSheetId: data?.planning?.googleSheetId || '',
			sheetName: data?.planning?.sheetName || '',
		};
	}

	static empty(guildId = ''): PermanantesConfig {
		return new PermanantesConfig({ discord: { guildId } as DiscordConfig });
	}

	static fromEnv(guildId: string): PermanantesConfig {
		const absenceAllowed = (process.env.ABSENCE_ALLOWED_ROLE_ID || '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		const birthdayAllowed = (process.env.BIRTHDAY_USERS_ROLES || '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);

		return new PermanantesConfig({
			discord: {
				guildId,
				material: {
					channelId: process.env.MATERIAL_CHANNEL_ID || '',
					informChannelId: process.env.INFORM_CHANNEL_ID || '',
				},
				absence: {
					channelId: process.env.ABSENCE_CHANNEL_ID || '',
					roleToNotifyId: process.env.NOTIFY_ROLE_ID || '',
					allowedRolesIds: absenceAllowed,
					warnTime: DEFAULT_ABSENCE_WARN_TIME,
				},
				birthday: {
					channelId: process.env.BIRTHDAY_CHANNEL_ID || '',
					allowedRolesIds: birthdayAllowed,
					warnTime: DEFAULT_BIRTHDAY_WARN_TIME,
				},
			},
			planning: {
				googleSheetId: process.env.GOOGLE_ABSENCES_FILE_ID || '',
				sheetName: (process.env.GOOGLE_ABSENCE_SHEET_NAME || '').replace(/^"|"$/g, ''),
			},
		});
	}

	withGuildId(guildId: string): PermanantesConfig {
		const base = this.toInterface();
		return new PermanantesConfig({
			...base,
			discord: {
				...base.discord,
				guildId,
			},
		});
	}

	toInterface(): IPermanantesConfig {
		return {
			discord: {
				guildId: this.discord.guildId,
				material: { ...this.discord.material },
				absence: {
					...this.discord.absence,
					allowedRolesIds: [...this.discord.absence.allowedRolesIds],
				},
				birthday: {
					...this.discord.birthday,
					allowedRolesIds: [...this.discord.birthday.allowedRolesIds],
				},
			},
			planning: { ...this.planning },
		};
	}
}
