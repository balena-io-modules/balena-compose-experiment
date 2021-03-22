import * as packageJson from '../package.json';


const version = packageJson.version;
const config = new Map();

config.set('fetchOptions', {
    'uuid': 'deafbeef',
    'currentApiKey': 'abc',
    'apiEndpoint': 'https://api.balena-cloud.com',
    'deltaEndpoint': 'https://delta.balena-cloud.com',
    'delta': true,
    'deltaRequestTimeout': 30000,
    'deltaApplyTimeout': 0,
    'deltaRetryCount': 30,
    'deltaRetryInterval': 10000,
    'deltaVersion': 3,
    'supervisorNetworkInterface': '',         // TODO: 
    'rootMountPoint': '',                     // TODO:
});

config.set('osVersion', '2.72');
config.set('version', version);
config.set('appUpdatePollInterval', 60000)

export default config;