import * as packageJson from '../package.json';

const version = packageJson.version;
const config = new Map();

// Set defaults
config.set('apiEndpoint', 'https://api.balena-cloud.com');
config.set('appUpdatePollInterval', 900000);
config.set('deltaEndpoint', 'https://delta.balena-cloud.com');
config.set('deviceType', 'raspberrypi4-64');
config.set('delta', true);
config.set('deltaRequestTimeout', 30000);
config.set('deltaRetryCount', 30);
config.set('deltaRetryInterval', 10000);
config.set('deltaVersion', 3);

// TODO: fetchOptions should be obtained from a combination of configs
config.set('fetchOptions', {
	uuid: config.get('uuid'),
	deviceApiKey: config.get('deviceApiKey'),
	apiEndpoint: config.get('apiEndpoint'),
	deltaEndpoint: config.get('deltaEndpoint'),
	delta: config.get('delta'),
	deltaRequestTimeout: config.get('deltaRequestTimeout'),
	deltaRetryCount: config.get('deltaRetryCount'),
	deltaRetryInterval: config.get('deltaRetryInterval'),
	deltaVersion: config.get('deltaVersion'),
});

config.set('osVersion', '2.72');
config.set('version', version);
config.set('appUpdatePollInterval', 60000);

export default config;
