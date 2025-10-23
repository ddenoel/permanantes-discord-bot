import { format, startOfDay } from 'date-fns';

import { fr } from 'date-fns/locale';

export class DateUtils {
	static formatDate(date: Date): string {
		return format(date, 'dd/MM/yyyy');
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
}
