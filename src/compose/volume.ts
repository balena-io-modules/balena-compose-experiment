import * as Docker from 'dockerode';
import assign = require('lodash/assign');
import isEqual = require('lodash/isEqual');
import omitBy = require('lodash/omitBy');

import constants = require('../lib/constants');
import { InternalInconsistencyError } from '../lib/errors';
import * as LogTypes from '../lib/log-types';
import { LabelObject } from '../lib/types';
import Logger from '../logger';
import * as ComposeUtils from './utils';

export interface VolumeConstructOpts {
	logger: Logger;
	docker: Docker;
}

export interface VolumeConfig {
	labels: LabelObject;
	driver: string;
	driverOpts: Docker.VolumeInspectInfo['Options'];
}

export interface ComposeVolumeConfig {
	driver: string;
	driver_opts: Dictionary<string>;
	labels: LabelObject;
}

export class Volume {
	private logger: Logger;
	private docker: Docker;

	private constructor(
		public name: string,
		public appId: number,
		public config: VolumeConfig,
		opts: VolumeConstructOpts,
	) {
		this.logger = opts.logger;
		this.docker = opts.docker;
	}

	public static fromDockerVolume(
		opts: VolumeConstructOpts,
		inspect: Docker.VolumeInspectInfo,
	): Volume {
		// Convert the docker inspect to the config
		const config: VolumeConfig = {
			labels: inspect.Labels || {},
			driver: inspect.Driver,
			driverOpts: inspect.Options || {},
		};

		// Detect the name and appId from the inspect data
		const { name, appId } = this.deconstructDockerName(inspect.Name);

		return new Volume(name, appId, config, opts);
	}

	public static fromComposeObject(
		name: string,
		appId: number,
		config: Partial<ComposeVolumeConfig>,
		opts: VolumeConstructOpts,
	) {
		const filledConfig: VolumeConfig = {
			driverOpts: config.driver_opts || {},
			driver: config.driver || 'local',
			labels: ComposeUtils.normalizeLabels(config.labels || {}),
		};

		// We only need to assign the labels here, as when we
		// get it from the daemon, they should already be there
		assign(filledConfig.labels, constants.defaultVolumeLabels);

		return new Volume(name, appId, filledConfig, opts);
	}

	public toComposeObject(): ComposeVolumeConfig {
		return {
			driver: this.config.driver,
			driver_opts: this.config.driverOpts!,
			labels: this.config.labels,
		};
	}

	public isEqualConfig(volume: Volume): boolean {
		return (
			isEqual(this.config.driver, volume.config.driver) &&
			isEqual(this.config.driverOpts, volume.config.driverOpts) &&
			isEqual(
				Volume.omitSupervisorLabels(this.config.labels),
				Volume.omitSupervisorLabels(volume.config.labels),
			)
		);
	}

	public async create(): Promise<void> {
		this.logger.logSystemEvent(LogTypes.createVolume, {
			volume: { name: this.name },
		});
		await this.docker.createVolume({
			Name: Volume.generateDockerName(this.appId, this.name),
			Labels: this.config.labels,
			Driver: this.config.driver,
			DriverOpts: this.config.driverOpts,
		});
	}

	public async remove(): Promise<void> {
		this.logger.logSystemEvent(LogTypes.removeVolume, {
			volume: { name: this.name },
		});

		try {
			await this.docker
				.getVolume(Volume.generateDockerName(this.appId, this.name))
				.remove();
		} catch (e) {
			this.logger.logSystemEvent(LogTypes.removeVolumeError, {
				volume: { name: this.name, appId: this.appId },
				error: e,
			});
		}
	}

	public static generateDockerName(appId: number, name: string) {
		return `${appId}_${name}`;
	}

	private static deconstructDockerName(
		name: string,
	): { name: string; appId: number } {
		const match = name.match(/(\d+)_(\S+)/);
		if (match == null) {
			throw new InternalInconsistencyError(
				`Could not detect volume data from docker name: ${name}`,
			);
		}

		const appId = parseInt(match[1], 10);
		if (isNaN(appId)) {
			throw new InternalInconsistencyError(
				`Could not detect application id from docker name: ${match[1]}`,
			);
		}

		return {
			appId,
			name: match[2],
		};
	}

	private static omitSupervisorLabels(labels: LabelObject): LabelObject {
		// TODO: Export these to a constant
		return omitBy(
			labels,
			(_v, k) => k === 'io.resin.supervised' || k === 'io.balena.supervised',
		);
	}
}

export default Volume;
