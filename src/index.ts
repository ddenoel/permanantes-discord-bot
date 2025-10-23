import { config } from 'dotenv';
import Express, { NextFunction, Request, Response } from 'express';
import discord from './discord';
import { App } from './app';

// Load environment variables
config();

const express = Express();

let app: App;

express.get('/ping', (_req: Request, res: Response) => {
	res.set('Cache-Control', 'no-store');
	res.type('text/plain').send('pong');
});

express.get('/ping-extended', (_req: Request, res: Response) => {
	res.set('Cache-Control', 'no-store');
	res.type('application/json').send({ data: 'pong', status: 'alive', date: new Date().toISOString() });
});

express.head('/ping', (_req: Request, res: Response) => {
	res.set('Cache-Control', 'no-store');
	res.type('text/plain').send('pong');
});

function verifyApiKey(req: Request, res: Response, next: NextFunction) {
	const apiKey = req.headers['x-api-key'];
	if (apiKey !== process.env.API_KEY) {
		return res.status(401).send('Unauthorized');
	}

	next();
}

express.put('/sync-planning', async (_req: Request, res: Response) => {
	if (!app) {
		return res.status(500).send('App not initialized');
	}
	verifyApiKey(_req, res, async () => {
		const result = await app.syncPlanning.execute();
		res.send(
			`Planning synced : ${result.createdOrUpdated} upserts, ${result.deleted} deletions, ${result.errors} errors`
		);
	});
});

express.listen(process.env.PORT, () => {
	console.info(`[server]: Server is running at ${process.env.SERVER_URL}:${process.env.PORT}`);
});

async function start() {
	const discordClient = await discord();
	app = new App(discordClient);

	app.scheduleTasks();
}

start();
