import { google, sheets_v4 } from 'googleapis';
import { config } from 'dotenv';

config();

type FindRowOptions = {
	spreadsheetId: string;
	sheetName: string;
	column: string; // ex: "A", "B", ...
	value: string;
};

export type Cell = {
	row: number;
	column: string;
};

export class GoogleService {
	private sheets: sheets_v4.Sheets;
	static UNFORMATTED_DATE_FORMAT = 'yyyy-MM-dd';

	private isInit = false;
	private connectPromise: Promise<void> | null = null;

	private formatSheetName(sheetName: string): string {
		if (/[\s\-\(\)\[\]{}]/.test(sheetName)) {
			return `'${sheetName}'`;
		}
		return sheetName;
	}

	private parseServiceAccountCredentials(): Record<string, any> {
		if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
			throw new Error('GOOGLE_SERVICE_ACCOUNT is not defined');
		}

		let credentials: Record<string, any>;
		try {
			credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
		} catch (e) {
			throw new Error('GOOGLE_SERVICE_ACCOUNT is not valid JSON');
		}

		if (!credentials.client_email || !credentials.private_key) {
			throw new Error('GOOGLE_SERVICE_ACCOUNT must include client_email and private_key');
		}

		// Render/env vars often keep literal "\n" instead of real newlines in private_key
		if (typeof credentials.private_key === 'string') {
			credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
		}

		return credentials;
	}

	async ensureConnected(): Promise<void> {
		if (this.isInit) return;
		if (!this.connectPromise) {
			this.connectPromise = this.connect().catch((e) => {
				this.connectPromise = null;
				throw e;
			});
		}
		await this.connectPromise;
	}

	async getFileName(spreadsheetId: string): Promise<string> {
		await this.ensureConnected();
		const res = await this.sheets.spreadsheets.get({
			spreadsheetId,
		});

		return res.data.properties?.title || '';
	}

	async connect() {
		if (this.isInit) {
			return;
		}

		const credentials = this.parseServiceAccountCredentials();
		const auth = new google.auth.GoogleAuth({
			credentials,
			scopes: ['https://www.googleapis.com/auth/spreadsheets'],
		});

		// Force token acquisition early to fail fast with a clearer error
		await auth.getClient();

		// Cast avoids TS conflict when multiple google-auth-library copies are nested by googleapis
		this.sheets = google.sheets({ version: 'v4', auth: auth as any });
		this.isInit = true;
		console.log(`🚀 Connected to Google as ${credentials.client_email}`);
	}

	constructor() {
		this.connectPromise = this.connect().catch((e) => {
			this.connectPromise = null;
			console.error('[GoogleService] Failed to connect:', e);
			throw e;
		});
	}

	async appendRow(
		spreadsheetId: string,
		range: string, // e.g. 'Feuille1!A1'
		values: (string | number)[]
	): Promise<void> {
		await this.ensureConnected();
		await this.sheets.spreadsheets.values.append({
			spreadsheetId,
			range,
			valueInputOption: 'USER_ENTERED',
			requestBody: {
				values: [values],
			},
		});
	}

	async findRowByColumnValue({
		spreadsheetId,
		sheetName,
		column,
		value,
	}: FindRowOptions): Promise<{ rowNumber: number; rowData: string[] } | null> {
		await this.ensureConnected();
		const range = `${this.formatSheetName(sheetName)}!${column}:${column}`;

		const res = await this.sheets.spreadsheets.values.get({
			spreadsheetId,
			range,
		});

		const rows = res.data.values;
		if (!rows) return null;

		for (let i = 0; i < rows.length; i++) {
			if (rows[i][0] === value) {
				const rowData = await this.sheets.spreadsheets.values.get({
					spreadsheetId,
					range: `${this.formatSheetName(sheetName)}!${i + 1}:${i + 1}`,
				});
				return { rowNumber: i + 1, rowData: rowData.data.values[0] }; // lignes sont 1-based
			}
		}

		return null;
	}

	async readSheet(
		spreadsheetId: string,
		sheetName: string,
		limitColumns: number = 1000,
		limitRows: number = 1000
	): Promise<string[][]> {
		await this.ensureConnected();
		const range = `${this.formatSheetName(sheetName)}!A1:${GoogleService.parseIndexToColumn(limitColumns)}${limitRows}`;
		const res = await this.sheets.spreadsheets.values.get({
			spreadsheetId,
			range,
		});
		return res.data.values;
	}

	static parseIndexToColumn(index: number): string {
		let col = '';
		while (index > 0) {
			index--;
			const remainder = index % 26;
			col = String.fromCharCode(65 + remainder) + col;
			index = Math.floor(index / 26);
		}
		return col;
	}

	async findColumnByPropValue(
		spreadsheetId: string,
		sheetName: string,
		rowNumber: number,
		value: string | number,
		useUnformattedValues: boolean = false
	): Promise<string | null> {
		await this.ensureConnected();

		const range = `${this.formatSheetName(sheetName)}!A${rowNumber}:ZZ${rowNumber}`;
		const res = await this.sheets.spreadsheets.values.get({
			spreadsheetId,
			range,
			valueRenderOption: useUnformattedValues ? 'UNFORMATTED_VALUE' : 'FORMATTED_VALUE',
		});

		const rows = res.data.values;
		if (!rows || rows.length === 0) return null;

		const row = rows[0];

		for (let i = 0; i < row.length; i++) {
			if (row[i] === value) {
				return GoogleService.parseIndexToColumn(i); // A, B, C, etc.
			}
		}

		return null;
	}

	async editRow(
		spreadsheetId: string,
		sheetName: string,
		rowNumber: number,
		values: (string | number)[]
	): Promise<void> {
		await this.ensureConnected();
		await this.sheets.spreadsheets.values.update({
			spreadsheetId,
			range: `${this.formatSheetName(sheetName)}!${rowNumber}:${rowNumber}`,
			valueInputOption: 'USER_ENTERED',
			requestBody: {
				values: [values],
			},
		});
	}

	async getCellValue(spreadsheetId: string, sheetName: string, cell: Cell): Promise<string | null> {
		await this.ensureConnected();
		const range = `${this.formatSheetName(sheetName)}!${cell.column}${cell.row}:${cell.column}${cell.row}`;
		const res = await this.sheets.spreadsheets.values.get({
			spreadsheetId,
			range,
		});
		const rows = res.data.values;
		if (!rows || rows.length === 0) return null;
		return rows[0][0] || null;
	}

	async editCell(spreadsheetId: string, sheetName: string, cell: Cell, value: string): Promise<void> {
		await this.ensureConnected();
		const range = `${this.formatSheetName(sheetName)}!${cell.column}${cell.row}:${cell.column}${cell.row}`;
		await this.sheets.spreadsheets.values.update({
			spreadsheetId,
			range,
			valueInputOption: 'USER_ENTERED',
			requestBody: {
				values: [[value]],
			},
		});
	}

	/**
	 * Récupère le nom de la feuille par son index (0 = première feuille)
	 */
	async getSheetNameByIndex(spreadsheetId: string, sheetIndex: number): Promise<string | null> {
		await this.ensureConnected();

		try {
			const response = await this.sheets.spreadsheets.get({
				spreadsheetId,
			});

			const sheets = response.data.sheets;
			if (!sheets || sheetIndex >= sheets.length) {
				console.error(`Sheet index ${sheetIndex} not found. Available sheets: ${sheets?.length || 0}`);
				return null;
			}

			return sheets[sheetIndex].properties?.title || null;
		} catch (error) {
			console.error('Error getting sheet name by index:', error);
			return null;
		}
	}
}
