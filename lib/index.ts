import { ImageInspectInfo } from 'dockerode';
import { promises as fs } from 'fs';
import * as _ from 'lodash';
import * as path from 'path';
import App from './compose/app';
import { CompositionStep, getExecutors } from './compose/composition-steps';
import * as dockerUtils from './compose/docker-utils';
import { pathExistsOnHost } from './compose/fs-utils';
import * as imageManager from './compose/images';
import { bestDeltaSource } from './compose/images';
import Network from './compose/network';
import * as networkManager from './compose/network-manager';
import Service from './compose/service';
import * as serviceManager from './compose/service-manager';
import { ComposeNetworkConfig } from './compose/types/network';
import { DeviceMetadata, ServiceComposeConfig } from './compose/types/service';
import Volume, { ComposeVolumeConfig } from './compose/volume';
import * as volumeManager from './compose/volume-manager';
import config from './config';
import constants from './constants';
import { InternalInconsistencyError, NotFoundError } from './errors';
import { LabelObject } from './types';
import * as updateLock from './update-lock';

export type ComposerOptions = {
	uuid: string;
	deviceApiKey: string;
	apiEndpoint?: string;
	deltaEndpoint?: string;
	delta?: boolean;
	deltaRequestTimeout?: number;
	deltaApplyTimeout?: number;
	deltaRetryCount?: number;
	deltaRetryInterval?: number;
	deltaVersion?: number;
};

type ComposerRuntime = {
	status: 'idle' | 'running';
	cancel: () => void;
};

export type ComposerState = {
	status: ComposerRuntime['status'];
	app: number; // app-id for now
	release?: string; // release-commit or version
	services: {
		[key: string]: Service;
	};
	volumes: {
		[key: string]: Volume;
	};
	networks: {
		[key: string]: Network;
	};
};

export type ComposerTarget = {
	name: string;
	commit?: string;
	releaseId?: number;
	services: {
		[serviceId: string]: {
			labels: LabelObject;
			imageId: number;
			serviceName: string;
			image: string;
			running?: boolean;
			environment: Dictionary<string>;
		} & ServiceComposeConfig;
	};
	volumes: Dictionary<Partial<ComposeVolumeConfig>>;
	networks: Dictionary<Partial<ComposeNetworkConfig>>;
};

function keys<T extends object>(value: T): Array<keyof T & string> {
	return Object.keys(value) as Array<keyof T & string>;
}

export async function lockingIfNecessary<T extends unknown>(
	appId: number,
	{ force = false, skipLock = false } = {},
	fn: () => Resolvable<T>,
) {
	if (skipLock) {
		return fn();
	}
	const lockOverride = (await config.get('lockOverride')) || force;
	return updateLock.lock(
		appId,
		{ force: lockOverride },
		fn as () => PromiseLike<void>,
	);
}

const actionExecutors = getExecutors({
	lockFn: lockingIfNecessary,
	callbacks: {
		containerStarted: (id: string | null) => {
			// containerStarted[id] = true;
			console.log('container started', id);
		},
		containerKilled: (id: string | null) => {
			// delete containerStarted[id];
			console.log('container killed', id);
		},
		fetchStart: () => {
			// fetchesInProgress += 1;
			console.log('fetch start');
		},
		fetchEnd: () => {
			console.log('fetch ended');
			// fetchesInProgress -= 1;
		},
		fetchTime: (time) => {
			console.log('fetch time', time);
			// timeSpentFetching += time;
		},
		stateReport: (state) => {
			console.log('current state', state);
			// reportCurrentState(state);
		},
		bestDeltaSource,
	},
});

export const validActions = Object.keys(actionExecutors);

async function executeStep(
	step: CompositionStep,
	{ force = false, skipLock = false } = {},
): Promise<void> {
	if (!validActions.includes(step.action)) {
		return Promise.reject(
			new InternalInconsistencyError(
				`Invalid composition step action: ${step.action}`,
			),
		);
	}

	// TODO: Find out why this needs to be cast, the typings should hold true
	await actionExecutors[step.action]({
		...step,
		force,
		skipLock,
	} as any);
}

export class Composer {
	private runtimeState: ComposerRuntime = {
		status: 'idle',
		cancel: () => void 0,
	};

	constructor(readonly app: number, readonly options: ComposerOptions) {
		// Set global options
		// TODO: improve this
		keys(options).forEach((key) => {
			config.set(key, options[key]);
		});
	}

	async state(): Promise<ComposerState> {
		const volumes = _.groupBy(await volumeManager.getAll(), 'appId');
		const networks = _.groupBy(await networkManager.getAll(), 'appId');
		const services = _.groupBy(await serviceManager.getAll(), 'appId');

		const allAppIds = _.union(
			Object.keys(volumes),
			Object.keys(networks),
			Object.keys(services),
		).map((i) => parseInt(i, 10));

		const appId = this.app;

		if (!allAppIds.includes(this.app)) {
			return {
				status: 'idle',
				app: appId,
				services: {},
				networks: {},
				volumes: {},
			};
		}

		// TODO: get commit from service labels
		const commit = 'abc';

		return {
			status: this.runtimeState.status,
			app: appId,
			release: commit,
			services: _.keyBy(services[appId], 'name'),
			networks: _.keyBy(networks[appId], 'name'),
			volumes: _.keyBy(volumes[appId], 'name'),
		};
	}

	private async fromTargetState(app: ComposerTarget): Promise<App> {
		const volumes = _.mapValues(app.volumes ?? {}, (conf, name) => {
			if (conf == null) {
				conf = {};
			}
			if (conf.labels == null) {
				conf.labels = {};
			}
			return Volume.fromComposeObject(name, this.app, conf);
		});

		const networks = _.mapValues(app.networks ?? {}, (conf, name) => {
			return Network.fromComposeObject(name, this.app, conf ?? {});
		});

		const [
			supervisorApiHost,
			hostPathExists,
			hostnameOnHost,
		] = await Promise.all([
			dockerUtils
				.getNetworkGateway(config.get('supervisorNetworkInterface'))
				.catch(() => '127.0.0.1'),
			(async () => ({
				firmware: await pathExistsOnHost('/lib/firmware'),
				modules: await pathExistsOnHost('/lib/modules'),
			}))(),
			(async () =>
				_.trim(
					await fs.readFile(
						path.join(constants.rootMountPoint, '/etc/hostname'),
						'utf8',
					),
				))(),
		]);

		const svcOpts = {
			appName: app.name,
			supervisorApiHost,
			hostPathExists,
			hostnameOnHost,
		};

		// In the db, the services are an array, but here we switch them to an
		// object so that they are consistent
		const services: Service[] = await Promise.all(
			keys(app.services ?? {})
				.map((serviceId) => ({ serviceId, ...app.services[serviceId] }))
				.map(async (svc: ServiceComposeConfig) => {
					// Try to fill the image id if the image is downloaded
					let imageInfo: ImageInspectInfo | undefined;
					try {
						imageInfo = await imageManager.inspectByName(svc.image);
					} catch (e) {
						if (!NotFoundError(e)) {
							throw e;
						}
					}

					const thisSvcOpts = {
						...svcOpts,
						imageInfo,
						serviceName: svc.serviceName,
					};

					// FIXME: Typings for DeviceMetadata
					return await Service.fromComposeObject(
						svc,
						(thisSvcOpts as unknown) as DeviceMetadata,
					);
				}),
		);
		return new App(
			{
				appId: this.app,
				commit: app.commit,
				releaseId: app.releaseId,
				appName: app.name,
				source: this.options.apiEndpoint,
				services,
				volumes,
				networks,
			},
			true,
		);
	}

	private async getRequiredSteps(
		target: ComposerTarget,
	): Promise<CompositionStep[]> {
		const volumes = _.groupBy(await volumeManager.getAll(), 'appId');
		const networks = _.groupBy(await networkManager.getAll(), 'appId');
		const services = _.groupBy(await serviceManager.getAll(), 'appId');

		const allAppIds = _.union(
			Object.keys(volumes),
			Object.keys(networks),
			Object.keys(services),
		).map((i) => parseInt(i, 10));

		const appId = this.app;
		let app: App;

		// TODO: get commit from service labels
		const commit = 'abc';

		if (!allAppIds.includes(this.app)) {
			app = new App(
				{
					appId,
					services: [],
					networks: {},
					volumes: {},
				},
				false,
			);
		} else {
			app = new App(
				{
					appId,
					commit,
					services: services[appId],
					networks: _.keyBy(networks[appId], 'name'),
					volumes: _.keyBy(volumes[appId], 'name'),
				},
				false,
			);
		}

		const [downloading, availableImages] = await Promise.all([
			imageManager.getDownloadingImageIds(),
			imageManager.getAvailable(services[appId]),
		]);

		const containerIds = await serviceManager.getContainerIdMap(appId);
		const targetApp = await this.fromTargetState(target);

		return app.nextStepsForAppUpdate(
			{
				localMode: false,
				availableImages,
				containerIds,
				downloading,
			},
			targetApp,
		);
	}

	private setRuntimeState(
		status: ComposerRuntime['status'],
		cancel: ComposerRuntime['cancel'] = () => void 0,
	) {
		this.runtimeState = { status, cancel };
	}

	public async update(target: ComposerTarget): Promise<ComposerState> {
		// Do not allow a new update if there is another one in progress
		if (this.runtimeState.status === 'running') {
			// TODO: there are two options here, cancel the already running
			// target state apply or reject the new update
			// TODO: throw a typed error here
			return Promise.reject('There is already an apply in progress');
		}

		const timeout = (ms: number) =>
			new Promise((resolve) => setTimeout(resolve, ms));

		const applyTarget = async (tgt: ComposerTarget): Promise<ComposerState> => {
			const steps = await this.getRequiredSteps(tgt);

			if (_.isEmpty(steps)) {
				// No more pending steps means, we are done,
				// resolve the promise with the current state
				return await this.state();
			}

			// If all steps are noop, wait 1 second and get
			// steps again
			if (_.every(steps, (step) => step.action === 'noop')) {
				await timeout(1000);
			} else {
				// execute any non-noop steps
				await Promise.all(
					// TODO: figure out force lock
					steps.map((s) => executeStep(s)),
				);
			}
			// call apply target again to apply any
			// pending steps
			return await applyTarget(target);
		};

		return await new Promise<ComposerState>(async (resolve, reject) => {
			try {
				// update the runtime state before calling the apply function
				this.setRuntimeState('running', reject);
				return resolve(await applyTarget(target));
			} catch (e) {
				reject(e);
			} finally {
				// reset the runtime state
				this.setRuntimeState('idle');
			}
		});
	}

	// Cancel any running target state apply
	public cancel() {
		this.runtimeState.cancel();
	}

	// Add listeners for container events
	public listen(_listener: any) {
		// TODO
	}
}
