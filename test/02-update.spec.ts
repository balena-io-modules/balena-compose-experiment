// import { expect } from './chai';
import { Composer, ComposerOptions, ComposerTarget } from '../lib/index';
import { testWithData } from './mocked-dockerode';
// import { Service } from 'dockerode';
// import * as dockerode from 'dockerode';

describe('Composer update:', function () {
	it('should be able to update state no containers', async function () {
		const options: ComposerOptions = {
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
		};

		const instance = new Composer(123, options);

		// const expected: ComposerState = {
		// 	status: 'idle',
		// 	app: 123,
		// 	services: {},
		// 	networks: {},
		// 	volumes: {},
		// };

		// const networks = {
		// 	'supervisor0': {
		// 		Name: '123_default',
		// 		IPAM: {
		// 			Config: [
		// 				{
		// 					Gateway: '',
		// 				},
		// 			],
		// 		},
		// 	},
		// };

		const networks = {
			supervisor0: {
				Name: '123_default',
				Id: '4e6a4ae2dc07f09503c0ffa15b85e7e05cc7b80c0b38ba2e56f14fda4685bf5b',
				Created: '2020-06-11T09:04:00.299972855Z',
				Scope: 'local',
				Driver: 'bridge',
				EnableIPv6: false,
				IPAM: {
					Driver: 'default',
					Options: {},
					Config: [
						{
							Subnet: '172.17.0.0/16',
							Gateway: '172.17.0.1',
						},
					],
				},
				Internal: false,
				Attachable: false,
				Ingress: false,
				ConfigFrom: {
					Network: '',
				},
				ConfigOnly: false,
				Containers: {},
				Options: {},
				Labels: {
					'io.balena.supervised': 'true',
				},
			},
			'123_default': {
				Name: '123_default',
				Id: '4e6a4ae2dc07f09503c0ffa15b85e7e05cc7b80c0b38ba2e56f14fda4685bf5b',
				Created: '2020-06-11T09:04:00.299972855Z',
				Scope: 'local',
				Driver: 'bridge',
				EnableIPv6: false,
				IPAM: {
					Driver: 'default',
					Options: {},
					Config: [
						{
							Subnet: '172.17.0.0/16',
							Gateway: '172.17.0.1',
						},
					],
				},
				Internal: false,
				Attachable: false,
				Ingress: false,
				ConfigFrom: {
					Network: '',
				},
				ConfigOnly: false,
				Containers: {},
				Options: {},
				Labels: {
					'io.balena.supervised': 'true',
				},
			},
		};

		await testWithData({ containers: [], networks }, async () => {
			const targetState: ComposerTarget = {
				name: 'something',
				networks: {},
				volumes: {},
				services: {},
			};
			const finalState = await instance.update(targetState);
			console.log(finalState);

			// await expect(instance.state()).to.eventually.deep.equal(expected);
		});
	});
});

// export type ComposerTarget = {
// 	name: string;
// 	commit?: string;
// 	releaseId?: number;
// 	services: {
// 		[serviceId: string]: {
// 			labels: LabelObject;
// 			imageId: number;
// 			serviceName: string;
// 			image: string;
// 			running?: boolean;
// 			environment: Dictionary<string>;
// 		} & ServiceComposeConfig;
// 	};
// 	volumes: Dictionary<Partial<ComposeVolumeConfig>>;
// 	networks: Dictionary<Partial<ComposeNetworkConfig>>;
// };

/* Update Scenarios TODO:

proposed minimal tests

download-then-kill strategy

Current State					Target State
------------					------------
no containers					no containers
no containers					1 container
1 container						no containers
1 container						same container

---------------------------------------
download-then-kill strategy

Current State					Target State
------------					------------
no containers					no containers
no containers					1 container
no containers					2 containers
1 container						no containers
2 container						no containers
1 container						same container
1 container						1 different container
2 container						2 different containers
2 container						1 different container and one same conatiner

kill-then-download strategy

Current State					Target State
------------					------------
no containers					1 container
1 container						no containers
1 container						same container
1 container						1 different container
2 container						2 different containers
2 container						1 different container and one same conatiner

TODO:  Add more scenarios based on update strategies.  Not all these are actually done.  Doing
       just enough for Hack Week.
*/
