import { Composer } from '../lib';

import { getSdk } from 'balena-sdk';
import * as yargs from 'yargs';
import { promises as fs } from 'fs';

async function up(args: any): Promise<void> {
	let targetState;
	if (args.file) {
		const data = await fs.readFile(args.file, { encoding: 'utf-8' });
		targetState = JSON.parse(data);
	} else {
		const balena = getSdk({
			apiUrl: args.apiUrl ?? 'https://api.balena-cloud.com',
		});
		await balena.auth.loginWithToken(args.apiKey);
		targetState = (
			await balena.models.device.getSupervisorTargetState(args.uuid)
		).local.apps[args.appid];
	}

	const composer = new Composer(args.appid, {
		uuid: args.uuid,
		deviceApiKey: args.apiKey,
		delta: args.delta,
		apiEndpoint: args.apiUrl ?? undefined,
		deltaEndpoint: args.deltaUrl ?? undefined,
	});

	console.debug('initial state:', await composer.state());
	console.debug('target state:', targetState);

	await composer.update(targetState);
}

async function down(args: any): Promise<void> {
	const composer = new Composer(args.appid, {
		uuid: args.uuid,
		deviceApiKey: args.apiKey,
		delta: args.delta,
	});
	await composer.update({ name: '', services: {}, volumes: {}, networks: {} });
}

async function main(): Promise<void> {
	try {
		await yargs(process.argv.slice(2))
			.usage('$0 [global args] [command] [args]')
			.option('file', {
				alias: 'f',
				type: 'string',
				description: 'target state to apply',
			})
			.option('appid', {
				alias: 'a',
				type: 'number',
			})
			.option('uuid', {
				alias: 'u',
				type: 'string',
			})
			.option('api-key', {
				type: 'string',
			})
			.option('api-url', {
				type: 'string',
			})
			.option('api-url', {
				type: 'string',
			})
			.option('delta-url', {
				type: 'string',
			})
			.command('up', 'apply target state', {}, up)
			.command('down', 'reset to empty state', {}, down)
			.demandCommand()
			.help().argv;
	} catch (e) {
		throw e;
	}
}

main()
	.then(() => {
		process.exit(0);
	})
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
