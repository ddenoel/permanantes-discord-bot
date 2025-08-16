import { config } from 'dotenv';
import axios from 'axios';
import Express, { Request, Response } from 'express';
import discord from './discord';
import { App } from './app';

// Load environment variables
config();

const express = Express();

express.get('/ping', (_req: Request, res: Response) => {
	res.send('pong');
});

express.get('/ping-extended', (_req: Request, res: Response) => {
	res.send({ data: 'pong', status: 'alive', date: new Date().toISOString() });
});

express.head('/ping', (_req: Request, res: Response) => {
	res.send('pong');
});

express.listen(process.env.PORT, () => {
	console.info(`[server]: Server is running at ${process.env.SERVER_URL}:${process.env.PORT}`);
});

async function start() {
	const discordClient = await discord();
	const app = new App(discordClient);

	app.scheduleTasks();
}

start();
