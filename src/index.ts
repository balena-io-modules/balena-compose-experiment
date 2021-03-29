import { Composer, ComposerTarget } from '../lib';

import logger from './logger';
import { getSdk } from 'balena-sdk';
import yargs from 'yargs';
import { promises as fs } from 'fs';
import * as path from 'path';

async function readConfig(args: any) {
	let defaultConf: any = {};
	try {
		const configPath =
			args.config ??
			path.join(process.env.HOME ?? '~/', `.balena`, `config.json`);
		defaultConf = JSON.parse(
			await fs.readFile(configPath, { encoding: 'utf-8' }),
		);
	} catch (e) {
		if (!(e instanceof SyntaxError)) {
			console.error(
				'Configuration file not found. Defaulting to command line arguments.',
			);
		} else {
			throw e;
		}
	}

	return {
		...defaultConf,
		...{
			uuid: args.uuid ?? defaultConf.uuid,
			deviceApiKey: args.deviceApiKey ?? defaultConf.deviceApiKey,
			apiEndpoint: args.apiEndpoint ?? defaultConf.apiEndpoint,
			deltaEndpoint: args.deltaEndpoint ?? defaultConf.deltaEndpoint,
		},
	};
}

async function up(args: any): Promise<void> {
	const config = await readConfig(args);
	if (!config.uuid) {
		throw new Error(
			'No uuid was provided. Update config.json on provide it as a command line argument.',
		);
	}

	if (!config.deviceApiKey) {
		throw new Error(
			'No apiKey was provided. Update config.json on provide it as a command line argument.',
		);
	}

	if (!args.app && !args.file) {
		throw new Error('Either an app or a target state file must be provided');
	}

	// In case only a file was provided, use a dummy app id
	let appId = 1;
	let targetState: ComposerTarget;
	if (args.file) {
		const data = await fs.readFile(args.file, { encoding: 'utf-8' });
		targetState = JSON.parse(data);
	} else {
		const balena = getSdk({
			apiUrl: config.apiEndpoint,
		});

		// Wait for login. This will fail if api key is invalid
		await balena.auth.loginWithToken(config.deviceApiKey);

		// Get the app id, this will fail if the device does not
		// have access to the app
		appId = (await balena.models.application.get(args.app)).id;

		// Get the target state from the cloud
		targetState = (
			await balena.models.device.getSupervisorTargetState(config.uuid)
		).local.apps[appId];
	}

	const composer = new Composer(appId, config);
	composer.listen(logger);

	await composer.update(targetState);
}

async function down(args: any): Promise<void> {
	const config = await readConfig(args);

	if (!config.uuid) {
		throw new Error(
			'No uuid was provided. Update config.json on provide it as a command line argument.',
		);
	}

	if (!config.deviceApiKey) {
		throw new Error(
			'No apiKey was provided. Update config.json on provide it as a command line argument.',
		);
	}

	if (!args.app) {
		throw new Error('No app argument was provided');
	}

	const balena = getSdk({
		apiUrl: config.apiEndpoint,
	});

	// Wait for login. This will fail if api key is invalid
	await balena.auth.loginWithToken(config.deviceApiKey);

	// Get the app id, this will fail if the device does not
	// have access to the app
	const appId = (await balena.models.application.get(args.app)).id;

	const composer = new Composer(appId, config);
	composer.listen(logger);
	await composer.update({ name: '', services: {}, volumes: {}, networks: {} });
}

const parser = yargs(process.argv.slice(2))
	.usage('$0 [global args] [command] [args]')
	.option('file', {
		alias: 'f',
		type: 'string',
		description: 'target state to apply',
	})
	.option('app', {
		alias: 'a',
		type: 'string',
		description: 'application name',
	})
	.option('uuid', {
		alias: 'u',
		type: 'string',
		description: 'device uuid',
	})
	.option('deviceApiKey', {
		type: 'string',
		description: 'device authentication token',
	})
	.option('apiEndpoint', {
		type: 'string',
	})
	.option('deltaEndpoint', {
		type: 'string',
	})
	.command('up', 'apply target state', {}, up)
	.command('down', 'reset to empty state', {}, down)
	.demandCommand()
	.help()
	.fail(function (msg, err, instance) {
		if (err) {
			// TODO: I should be able to throw this error but it gets eaten somewhere
			console.error('Error: ', err.message);
			process.exit(1);
		}

		// Not an exception, show help
		console.error(msg);
		console.error(instance.help());
		process.exit(1);
	});
(async () => {
	await parser.parse();
})();
