import { config } from 'dotenv';
import axios from 'axios';
import Express, { Request, Response } from 'express';
import discord from './discord';

// Load environment variables
config();

// Temporary hack to avoid Render spin down with inactivity

const app = Express();

app.get('/ping', (_req: Request, res: Response) => {
	res.send('pong');
});

app.listen(process.env.PORT, () => {
	console.info(`[server]: Server is running at ${process.env.SERVER_URL}:${process.env.PORT}`);
});

const interval = 10 * 60 * 1000; // Interval in milliseconds (10 mins)

function reloadWebsite() {
	axios
		.get(`${process.env.SERVER_URL}/ping`)
		.then((response) => {
			console.info(`Reloaded at ${new Date().toISOString()}: Status Code ${response.status}`);
		})
		.catch((error) => {
			console.error(`Error reloading at ${new Date().toISOString()}:`, error.message);
		});
}

if (process.env.ENV_NAME !== 'development') {
	setInterval(reloadWebsite, interval);
}

discord();
