export class MiscellaneousUtils {
	static getRandomAmongList<T>(list: T[]): T {
		return list[Math.floor(Math.random() * list.length)];
	}

	static uppercaseFirstLetter(str: string): string {
		if (!str) return '';
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	static truncateString(str: string, maxLength: number): string {
		if (!str) return '';
		if (str.length <= maxLength) return str;
		return str.slice(0, maxLength) + '...';
	}
}
