import { format, startOfDay } from 'date-fns';

import { fr } from 'date-fns/locale';

export class DateUtils {
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
}
