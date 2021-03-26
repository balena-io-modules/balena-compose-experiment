import { ImageInspectInfo } from 'dockerode';
import * as _ from 'lodash';
import App from './compose/app';
import { CompositionStep, getExecutors } from './compose/composition-steps';
import * as dockerUtils from './compose/docker-utils';
// import { pathExistsOnHost } from './compose/fs-utils';
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
import log, { LogListener } from './console';

// Re export
export { LogListener, LogLevel } from './console';

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
	hostNameOnHost?: string;
	appUpdatePollInterval?: number;
	deviceType?: string;
	deviceName?: string;
	deviceArch?: string;
	osVersion?: string;

	// supervisor port
	listenPort?: number;
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

// utility function to prevent typescript from complaining
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
		containerStarted: (_id: string | null) => {
			// TODO: containerStarted[id] = true;
		},
		containerKilled: (_id: string | null) => {
			// TODO: delete containerStarted[id];
		},
		fetchStart: () => {
			// TODO: fetchesInProgress += 1;
		},
		fetchEnd: () => {
			// TODO: fetchesInProgress -= 1;
		},
		fetchTime: (time) => {
			log.info('fetch time', time);
			// TODO: timeSpentFetching += time;
		},
		stateReport: (_state) => {
			// TODO: reportCurrentState(state);
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

/**
 * Default composer configuration options
 */
const defaultComposerOptions: Partial<ComposerOptions> = {
	apiEndpoint: 'https://api.balena-cloud.com',
	deltaEndpoint: 'https://delta.balena-cloud.com',
	delta: false,
	deltaRequestTimeout: 30000,
	deltaRetryCount: 30,
	deltaRetryInterval: 10000,
	deltaVersion: 3,
	deviceType: 'raspberrypi3',
	deviceArch: 'armv7',
	osVersion: '2.72.1',
	appUpdatePollInterval: 900000,
	hostNameOnHost: 'balena',
	deviceName: 'balena',
	listenPort: 48484,
};

export class Composer {
	private runtimeState: ComposerRuntime = {
		status: 'idle',
		cancel: () => void 0,
	};

	private readonly options: ComposerOptions;

	constructor(readonly appId: number, options: ComposerOptions) {
		this.options = { ...defaultComposerOptions, ...options };

		// Set global options.
		keys(this.options).forEach((key) => {
			config.set(key, this.options[key]);
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

		const appId = this.appId;

		if (!allAppIds.includes(this.appId)) {
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
			services: _.keyBy(services[appId], 'serviceId'),
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
			return Volume.fromComposeObject(name, this.appId, conf);
		});

		const networks = _.mapValues(app.networks ?? {}, (conf, name) => {
			return Network.fromComposeObject(name, this.appId, conf ?? {});
		});

		// TODO: figure out how to handle these paths
		const [supervisorApiHost] = await Promise.all([
			dockerUtils
				.getNetworkGateway(constants.supervisorNetworkInterface)
				.catch(() => '127.0.0.1'),
			// (async () => ({
			// 	firmware: await pathExistsOnHost('/lib/firmware'),
			// 	modules: await pathExistsOnHost('/lib/modules'),
			// }))(),
		]);
		const hostPathExists = true;
		const svcOpts = {
			appName: app.name,
			supervisorApiHost,
			hostPathExists,
			hostnameOnHost: this.options.hostNameOnHost,
			listenPort: this.options.listenPort,
			uuid: this.options.uuid,
			deviceType: this.options.deviceType,
			deviceArch: this.options.deviceArch,
			osVersion: this.options.osVersion,
		};

		// In the db, the services are an array, but here we switch them to an
		// object so that they are consistent
		const services: Service[] = await Promise.all(
			keys(app.services ?? {})
				.map((serviceId) => ({
					serviceId,
					appId: this.appId,
					releaseId: app.releaseId,
					...app.services[serviceId],
				}))
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
				appId: this.appId,
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

		const appId = this.appId;
		let app: App;

		// TODO: get commit from service labels
		const commit = 'abc';

		if (!allAppIds.includes(this.appId)) {
			app = new App(
				{
					appId,
					commit,
					services: services[appId] ?? [],
					networks: _.keyBy(networks[appId], 'name') ?? {},
					volumes: _.keyBy(volumes[appId], 'name') ?? {},
				},
				false,
			);
		} else {
			app = new App(
				{
					appId,
					commit,
					services: services[appId] ?? [],
					networks: _.keyBy(networks[appId], 'name'),
					volumes: _.keyBy(volumes[appId], 'name'),
				},
				false,
			);
		}

		const [downloading, availableImages] = await Promise.all([
			imageManager.getDownloadingImageIds(),
			imageManager.getAvailableFromEngine(),
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
				log.info('Applying target state');
				this.setRuntimeState('running', reject);
				return resolve(await applyTarget(target));
			} catch (e) {
				reject(e);
			} finally {
				// reset the runtime state
				this.setRuntimeState('idle');
				log.success('Target state applied');
			}
		});
	}

	// Cancel any running target state apply
	public cancel() {
		this.runtimeState.cancel();
	}

	public listen(listener: LogListener) {
		log.listen(listener);
	}

	// Add listeners for container events
	public onStateChange(_listener: any) {
		// TODO
	}
}
