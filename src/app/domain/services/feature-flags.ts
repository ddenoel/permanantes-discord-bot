function parseBooleanFlag(value: string | undefined, defaultValue = true): boolean {
	if (value === undefined || value === '') return defaultValue;
	const normalized = value.trim().toLowerCase();
	if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
	if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
	return defaultValue;
}

export class FeatureFlags {
	static isAbsenceMessagesEnabled(): boolean {
		return parseBooleanFlag(process.env.ABSENCE_MESSAGES_ENABLED, true);
	}
}
