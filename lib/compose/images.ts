import * as Bluebird from 'bluebird';
import * as Docker from 'dockerode';
import * as _ from 'lodash';

import config from '../config';
import constants from '../constants';
import {
	DeltaFetchOptions,
	FetchOptions,
	docker,
	dockerToolbelt,
} from './docker-utils';
import * as dockerUtils from './docker-utils';
import { DeltaStillProcessingError, NotFoundError } from '../errors';
import * as LogTypes from '../log-types';
import * as validation from '../validation';
import * as logger from '../logger';
import { ImageDownloadBackoffError } from './errors';

import type { Service } from './service';

interface FetchProgressEvent {
	percentage: number;
}

export interface Image {
	id?: number;
	// image registry/repo@digest or registry/repo:tag
	name: string;
	appId: number;
	serviceId: number;
	serviceName: string;
	// Id from balena api
	imageId: number;
	releaseId: number;
	dependent: number;
	dockerImageId?: string;
	status?: 'Downloading' | 'Downloaded' | 'Deleting';
	downloadProgress?: number | null;
}

// TODO: Remove the need for this type...
type NormalisedDockerImage = Docker.ImageInfo & {
	NormalisedRepoTags: string[];
};

const imageFetchFailures: Dictionary<number> = {};
const imageFetchLastFailureTime: Dictionary<
	ReturnType<typeof process.hrtime>
> = {};

// A store of volatile state for images (e.g. download progress), indexed by imageId
const volatileState: { [imageId: number]: Image } = {};

const appUpdatePollInterval: number = config.get('appUpdatePollInterval');

type ServiceInfo = Pick<
	Service,
	'imageName' | 'appId' | 'serviceId' | 'serviceName' | 'imageId' | 'releaseId'
>;
export function imageFromService(service: ServiceInfo): Image {
	// We know these fields are defined because we create these images from target state
	return {
		name: service.imageName!,
		appId: service.appId,
		serviceId: service.serviceId!,
		serviceName: service.serviceName!,
		imageId: service.imageId!,
		releaseId: service.releaseId!,
		dependent: 0,
	};
}

export function bestDeltaSource(
	image: Image,
	available: Image[],
): string | null {
	// TODO: how do we compare to images on the engine
	for (const availableImage of available) {
		if (availableImage.appId === image.appId) {
			return availableImage.name;
		}
	}

	return null;
}

export async function triggerFetch(
	image: Image,
	opts: FetchOptions,
	onFinish = _.noop,
	serviceName: string,
): Promise<void> {
	if (imageFetchFailures[image.name] != null) {
		// If we are retrying a pull within the backoff time of the last failure,
		// we need to throw an error, which will be caught in the device-state
		// engine, and ensure that we wait a bit lnger
		const minDelay = Math.min(
			2 ** imageFetchFailures[image.name] * constants.backoffIncrement,
			appUpdatePollInterval,
		);
		const timeSinceLastError = process.hrtime(
			imageFetchLastFailureTime[image.name],
		);
		const timeSinceLastErrorMs =
			timeSinceLastError[0] * 1000 + timeSinceLastError[1] / 1e6;
		if (timeSinceLastErrorMs < minDelay) {
			throw new ImageDownloadBackoffError();
		}
	}

	const onProgress = (progress: FetchProgressEvent) => {
		// Only report the percentage if we haven't finished fetching
		if (volatileState[image.imageId] != null) {
			reportChange(image.imageId, {
				downloadProgress: progress.percentage,
			});
		}
	};

	let success: boolean;
	try {
		const imageName = await normalise(image.name);
		image = _.clone(image);
		image.name = imageName;

		onFinish(true);
		return;
	} catch (e) {
		if (!NotFoundError(e)) {
			if (!(e instanceof ImageDownloadBackoffError)) {
				addImageFailure(image.name);
			}
			throw e;
		}
		reportChange(
			image.imageId,
			_.merge(_.clone(image), { status: 'Downloading', downloadProgress: 0 }),
		);

		try {
			if (opts.delta && (opts as DeltaFetchOptions).deltaSource != null) {
				await fetchDelta(image, opts, onProgress, serviceName);
			} else {
				await fetchImage(image, opts, onProgress);
			}

			logger.logSystemEvent(LogTypes.downloadImageSuccess, { image });
			success = true;
			delete imageFetchFailures[image.name];
			delete imageFetchLastFailureTime[image.name];
		} catch (err) {
			if (err instanceof DeltaStillProcessingError) {
				// If this is a delta image pull, and the delta still hasn't finished generating,
				// don't show a failure message, and instead just inform the user that it's remotely
				// processing
				logger.logSystemEvent(LogTypes.deltaStillProcessingError, {});
			} else {
				addImageFailure(image.name);
				logger.logSystemEvent(LogTypes.downloadImageError, {
					image,
					error: err,
				});
			}
			success = false;
		}
	}

	reportChange(image.imageId);
	onFinish(success);
}

// async function getNormalisedTags(
// 	image: Docker.ImageInfo,
// ): Promise<string[]> {
// 	return await Bluebird.map(
// 		image.RepoTags != null ? image.RepoTags : [],
// 		normalise,
// 	);
// }

function addImageFailure(imageName: string, time = process.hrtime()) {
	imageFetchLastFailureTime[imageName] = time;
	imageFetchFailures[imageName] =
		imageFetchFailures[imageName] != null
			? imageFetchFailures[imageName] + 1
			: 1;
}

function matchesTagOrDigest(
	image: Image,
	dockerImage: NormalisedDockerImage,
): boolean {
	return (
		_.includes(dockerImage.NormalisedRepoTags, image.name) ||
		_.some(dockerImage.RepoDigests, (digest) =>
			hasSameDigest(image.name, digest),
		)
	);
}

export function isAvailableInDocker(
	image: Image,
	dockerImages: NormalisedDockerImage[],
): boolean {
	return _.some(
		dockerImages,
		(dockerImage) =>
			matchesTagOrDigest(image, dockerImage) ||
			image.dockerImageId === dockerImage.Id,
	);
}

// OK :). Was looking at composition-steps.ts :thumbsup:
// oh, I'm trying to figure out that one too :)
// Cool, all yours
export function getAvailable(services: Service[]): Image[] {
	return services.map((service) => imageFromService(service));
}

export function getDownloadingImageIds(): number[] {
	return _.keys(_.pickBy(volatileState, { status: 'Downloading' })).map((i) =>
		validation.checkInt(i),
	) as number[];
}

// TODO: not sure yet what to return from this
//  export const getStatus = async () => {
// 	const images = await getAvailable();
// 	for (const image of images) {
// 		image.status = 'Downloaded';
// 		image.downloadProgress = null;
// 	}
// 	const status = _.clone(volatileState);
// 	for (const image of images) {
// 		if (status[image.imageId] == null) {
// 			status[image.imageId] = image;
// 		}
// 	}
// 	return _.values(status);
// };

export async function inspectByName(
	imageName: string,
): Promise<Docker.ImageInspectInfo> {
	const image = docker.getImage(imageName);
	return await image.inspect();
}

export function isSameImage(
	image1: Pick<Image, 'name'>,
	image2: Pick<Image, 'name'>,
): boolean {
	return (
		image1?.name === image2?.name || hasSameDigest(image1?.name, image2?.name)
	);
}

function normalise(imageName: string): Bluebird<string> {
	return dockerToolbelt.normaliseImageName(imageName);
}

function hasSameDigest(
	name1: Nullable<string>,
	name2: Nullable<string>,
): boolean {
	const hash1 = name1 != null ? name1.split('@')[1] : null;
	const hash2 = name2 != null ? name2.split('@')[1] : null;
	return hash1 != null && hash1 === hash2;
}

async function fetchDelta(
	image: Image,
	opts: FetchOptions,
	onProgress: (evt: FetchProgressEvent) => void,
	serviceName: string,
): Promise<string> {
	logger.logSystemEvent(LogTypes.downloadImageDelta, { image });

	const deltaOpts = (opts as unknown) as DeltaFetchOptions;
	const srcImage = await inspectByName(deltaOpts.deltaSource);

	deltaOpts.deltaSourceId = srcImage.Id;
	const id = await dockerUtils.fetchDeltaWithProgress(
		image.name,
		deltaOpts,
		onProgress,
		serviceName,
	);

	if (!hasDigest(image.name)) {
		const { repo, tag } = await dockerUtils.getRepoAndTag(image.name);
		await docker.getImage(id).tag({ repo, tag });
	}

	return id;
}

function fetchImage(
	image: Image,
	opts: FetchOptions,
	onProgress: (evt: FetchProgressEvent) => void,
): Promise<string> {
	logger.logSystemEvent(LogTypes.downloadImage, { image });
	return dockerUtils.fetchImageWithProgress(image.name, opts, onProgress);
}

// TODO: find out if imageId can actually be null
// TODO: find out if imageId can actually be null
function reportChange(imageId: Nullable<number>, status?: Partial<Image>) {
	if (imageId == null) {
		return;
	}
	if (status != null) {
		if (volatileState[imageId] == null) {
			volatileState[imageId] = { imageId } as Image;
		}
		_.merge(volatileState[imageId], status);
		return; // events.emit('change');
	} else if (volatileState[imageId] != null) {
		delete volatileState[imageId];
		return; // events.emit('change');
	}
}

function hasDigest(name: Nullable<string>): boolean {
	if (name == null) {
		return false;
	}
	const parts = name.split('@');
	return parts[1] != null;
}
