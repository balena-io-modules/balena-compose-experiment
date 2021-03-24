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

		const networks = {
			supervisor0: {
				Name: 'supervisor0',
				IPAM: {
					Config: [
						{
							Gateway: '',
						},
					],
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
