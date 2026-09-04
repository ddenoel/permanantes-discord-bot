import { format, startOfDay, parse, isValid } from 'date-fns';

import { fr } from 'date-fns/locale';
import { MiscellaneousUtils } from './miscellaneous.utils';

export class DateUtils {
	static formatDate(date: Date): string {
		return format(date, 'dd/MM/yyyy');
	}

	static formatWeekday(date: Date): string {
		return MiscellaneousUtils.uppercaseFirstLetter(format(date, 'EEEE', { locale: fr }));
	}

	static formatDateWithWeekday(date: Date): string {
		return `${this.formatWeekday(date)} ${this.formatDate(date)}`;
	}

	static parseFrenchDate(dateStr: string): Date | null {
		if (!dateStr) return null;
		const parsed = parse(dateStr.trim(), 'dd/MM/yyyy', new Date());
		if (!isValid(parsed)) return null;
		const start = startOfDay(parsed);
		return start;
	}

	static isSameDay(date1: Date, date2: Date): boolean {
		return startOfDay(date1).getTime() === startOfDay(date2).getTime();
	}

	static formatDateList(dates: Date[]): string {
		if (dates.length === 1) {
			if (this.isSameDay(dates[0], new Date())) {
				return "aujourd'hui";
			}
			return `le ${format(dates[0], 'dd MMMM yyyy', { locale: fr })}`;
		}

		const formattedDates = dates.map((d) => format(d, 'dd MMMM yyyy', { locale: fr }));
		return `les ${formattedDates.slice(0, -1).join(', ')} et ${formattedDates.slice(-1)}`;
	}

	static formatDayMonth(day: number, month: number): string {
		try {
			const d = new Date(2000, month - 1, day);
			return format(d, 'd MMMM', { locale: fr });
		} catch {
			return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
		}
	}

	static getMaxDayForMonth(month: number): number {
		if (month === 2) return 28; // voluntary choice to not handle leap years
		if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
		return 31;
	}

	static getMonthNumberFromFrenchName(month: string): number {
		if (!month) {
			return null;
		}
		const months = {
			janvier: 1,
			fevrier: 2,
			mars: 3,
			avril: 4,
			mai: 5,
			juin: 6,
			juillet: 7,
			août: 8,
			septembre: 9,
			octobre: 10,
			novembre: 11,
			decembre: 12,
		};

		return months[month];
	}

	static readonly DEFAULT_ABSENCE_WARN_TIME = '07:00';
	static readonly DEFAULT_BIRTHDAY_WARN_TIME = '08:00';

	static parseHhMm(value?: string): { hour: number; minute: number } | null {
		if (!value) return null;
		const match = value.trim().match(/^(\d{1,2})h(\d{2})$|^(\d{1,2}):(\d{2})$/i);
		if (!match) return null;
		const hour = Number(match[1] ?? match[3]);
		const minute = Number(match[2] ?? match[4]);
		if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
		if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
		return { hour, minute };
	}

	static normalizeHhMm(value: string | undefined, fallback: string): string {
		const parsed = this.parseHhMm(value) || this.parseHhMm(fallback);
		if (!parsed) return fallback;
		return `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`;
	}

	static toDailyCron(hhmm: string | undefined, fallback: string): string {
		const normalized = this.normalizeHhMm(hhmm, fallback);
		const parsed = this.parseHhMm(normalized)!;
		return `${parsed.minute} ${parsed.hour} * * *`;
	}
}
