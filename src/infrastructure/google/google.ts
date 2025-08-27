import { google, Auth, sheets_v4 } from 'googleapis';
import { config } from 'dotenv';

config();

type FindRowOptions = {
	spreadsheetId: string;
	sheetName: string;
	column: string; // ex: "A", "B", ...
	value: string;
};

type Cell = {
	row: number;
	column: string;
};

export class GoogleService {
	private auth: Auth.GoogleAuth;
	private sheets: ReturnType<typeof google.sheets>;

	private isInit = false;

	async connect() {
		if (this.isInit) {
			return;
		}
		if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
			throw new Error('GOOGLE_SERVICE_ACCOUNT is not defined');
		}
		const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
		this.auth = new google.auth.GoogleAuth({
			credentials,
			scopes: ['https://www.googleapis.com/auth/spreadsheets'],
		});

		this.sheets = google.sheets({ version: 'v4', auth: this.auth });
		this.isInit = true;
		console.log('🚀 Connected to Google');
	}

	constructor() {
		this.connect();
	}

	async appendRow(
		spreadsheetId: string,
		range: string, // e.g. 'Feuille1!A1'
		values: (string | number)[]
	): Promise<void> {
		if (!this.isInit) {
			console.error('GoogleService is not initialized');
			return null;
		}
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
		if (!this.isInit) {
			console.error('GoogleService is not initialized');
			return null;
		}
		const range = `${sheetName}!${column}:${column}`;

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
					range: `${sheetName}!${i + 1}:${i + 1}`,
				});
				return { rowNumber: i + 1, rowData: rowData.data.values[0] }; // lignes sont 1-based
			}
		}

		return null;
	}

	async findColumnByRowValue(
		spreadsheetId: string,
		sheetName: string,
		rowNumber: number,
		value: string
	): Promise<string | null> {
		if (!this.isInit) {
			console.error('GoogleService is not initialized');
			return null;
		}

		const range = `${sheetName}!A${rowNumber}:ZZ${rowNumber}`;
		const res = await this.sheets.spreadsheets.values.get({
			spreadsheetId,
			range,
		});

		const rows = res.data.values;
		if (!rows || rows.length === 0) return null;

		const row = rows[0];

		for (let i = 0; i < row.length; i++) {
			if (row[i] === value) {
				return String.fromCharCode(65 + i); // A, B, C, etc.
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
		if (!this.isInit) {
			console.error('GoogleService is not initialized');
			return;
		}
		await this.sheets.spreadsheets.values.update({
			spreadsheetId,
			range: `${sheetName}!${rowNumber}:${rowNumber}`,
			valueInputOption: 'USER_ENTERED',
			requestBody: {
				values: [values],
			},
		});
	}

	async getCellValue(spreadsheetId: string, sheetName: string, cell: Cell): Promise<string | null> {
		if (!this.isInit) {
			console.error('GoogleService is not initialized');
			return null;
		}
		const range = `${sheetName}!${cell.column}${cell.row}:${cell.column}${cell.row}`;
		const res = await this.sheets.spreadsheets.values.get({
			spreadsheetId,
			range,
		});
		const rows = res.data.values;
		if (!rows || rows.length === 0) return null;
		return rows[0][0] || null;
	}

	async editCell(spreadsheetId: string, sheetName: string, cell: Cell, value: string): Promise<void> {
		if (!this.isInit) {
			console.error('GoogleService is not initialized');
			return;
		}
		const range = `${sheetName}!${cell.column}${cell.row}:${cell.column}${cell.row}`;
		await this.sheets.spreadsheets.values.update({
			spreadsheetId,
			range,
			valueInputOption: 'USER_ENTERED',
			requestBody: {
				values: [[value]],
			},
		});
	}
}
