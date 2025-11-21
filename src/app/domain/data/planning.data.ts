import { ActivityType } from '../entities/planning.entity';

export const ACTIVITY_TYPE_EMOJI: Record<ActivityType, string> = {
	theater: '🎭',
	singing: '🎤',
	dance: '💃',
	general_rehearsal: '👯',
	other: null,
	to_be_defined: '❓',
	unknown: null,
};
