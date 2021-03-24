import { Composer, ComposerTarget } from '../lib';

async function up(composer: Composer, targetStatePath: string): Promise<void> {
	const target_state = require(targetStatePath);
	const initial_state = await composer.state();

	console.debug("initial state:", initial_state);
	console.debug("target state:", target_state);

	await composer.update(target_state);
}

async function down(composer: Composer): Promise<void> {
	const target_state: ComposerTarget = {
		name: 'test1',
		services: {},
		volumes: {},
		networks: {},
	};
	await composer.update(target_state);
}

async function main(): Promise<void> {
	// TODO probably only works when you do `node index.js up`
	const argv = process.argv.slice(2);
	const command = argv[0];
	const composer = new Composer(1, {
		uuid: '1',
		deviceApiKey: '123',
		apiEndpoint: 'url',
		deltaEndpoint: 'endpoint',
		delta: true,
		deltaRequestTimeout: 10,
		deltaApplyTimeout: 10,
		deltaRetryCount: 10,
		deltaRetryInterval: 10,
		deltaVersion: 10,
	});

	try {
		switch (command) {
		case "help":
		case "-h":
		case "--help":
			console.log("usage: balena-compose [command]");
			break;

		case "version":
		case "--version":
			console.log("balena-compose 0.0.0");
			break;

		case "up":
			await up(composer, argv[1]);
			break;

		case "down":
			await down(composer);
			break;

		default:
			throw new Error(`subcommand not known: ${argv[0]}`);
		}
	} catch (e) {
		throw e
	}
}

main()
	.then(() => {
		process.exit(0);
	})
	.catch(e => {
		console.error(e);
		process.exit(1);
	});
