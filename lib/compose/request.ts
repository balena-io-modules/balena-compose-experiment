import * as Bluebird from 'bluebird';
import once = require('lodash/once');
import * as requestLib from 'request';
import * as resumableRequestLib from 'resumable-request';

import config from '../config';

export { requestLib };

// With these settings, the device must be unable to receive a single byte
// from the network for a continuous period of 20 minutes before we give up.
// (reqTimeout + retryInterval) * retryCount / 1000ms / 60sec ~> minutes
const DEFAULT_REQUEST_TIMEOUT = 30000; // ms
const DEFAULT_REQUEST_RETRY_INTERVAL = 10000; // ms
const DEFAULT_REQUEST_RETRY_COUNT = 30;

type PromisifiedRequest = typeof requestLib & {
	delAsync: (
		uri: string | requestLib.CoreOptions,
		options?: requestLib.CoreOptions | undefined,
	) => Bluebird<[requestLib.Response, any]>;
	putAsync: (
		uri: string | requestLib.CoreOptions,
		options?: requestLib.CoreOptions | undefined,
	) => Bluebird<[requestLib.Response, any]>;
	postAsync: (
		uri: string | requestLib.CoreOptions,
		options?: requestLib.CoreOptions | undefined,
	) => Bluebird<[requestLib.Response, any]>;
	patchAsync: (
		uri: string | requestLib.CoreOptions,
		options?: requestLib.CoreOptions | undefined,
	) => Bluebird<[requestLib.Response, any]>;
	getAsync: (
		uri: string | requestLib.CoreOptions,
		options?: requestLib.CoreOptions | undefined,
	) => Bluebird<[requestLib.Response, any]>;
};

const getRequestInstances = once(async () => {
	// Generate the user agents with out versions
	const osVersion = config.get('osVersion');
	let userAgent = `balena-compose/${config.get('version')}`;
	if (osVersion != null) {
		userAgent += ` (Linux; ${osVersion})`;
	}

	const requestOpts: requestLib.CoreOptions = {
		gzip: true,
		timeout: DEFAULT_REQUEST_TIMEOUT,
		headers: {
			'User-Agent': userAgent,
		},
	};

	const resumableOpts = {
		timeout: DEFAULT_REQUEST_TIMEOUT,
		maxRetries: DEFAULT_REQUEST_RETRY_COUNT,
		retryInterval: DEFAULT_REQUEST_RETRY_INTERVAL,
	};

	const requestHandle = requestLib.defaults(requestOpts);

	const request = Bluebird.promisifyAll(requestHandle, {
		multiArgs: true,
	}) as PromisifiedRequest;
	const resumable = resumableRequestLib.defaults(resumableOpts);

	return {
		requestOpts,
		request,
		resumable,
	};
});

export const getRequestInstance = once(async () => {
	return (await getRequestInstances()).request;
});

export const getRequestOptions = once(async () => {
	return (await getRequestInstances()).requestOpts;
});

export const getResumableRequest = once(async () => {
	return (await getRequestInstances()).resumable;
});
