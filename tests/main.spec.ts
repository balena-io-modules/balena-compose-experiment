// import { expect } from './chai';
// import { Composer, ComposerOptions } from '../lib/index';

// export type ComposerState = {
// 	status: ComposerRuntime['status'];
// 	app: number; // app-id for now
// 	release?: string; // release-commit or version
// 	services: {
// 		[key: string]: Service;
// 	};
// 	volumes: {
// 		[key: string]: Volume;
// 	};
// 	networks: {
// 		[key: string]: Network;
// 	};
// };

describe('TypeScript library skeleton:', function () {
	it('should be able to call myFunc on a new instance', async function () {
		// const options: ComposerOptions = {
		// 	uuid: '1',
		// 	apiKey: '123',
		// 	apiEndpoint: 'url',
		// 	deltaEndpoint: 'endpoint',
		// 	delta: true,
		// 	deltaRequestTimeout: 10,
		// 	deltaApplyTimeout: 10,
		// 	deltaRetryCount: 10,
		// 	deltaRetryInterval: 10,
		// 	deltaVersion: 10,
		// };
		// const instance = new Composer(123, options);
		// const expected = {
		// 	status: 'idle',
		// 	app: '123',
		// 	volumes: [],
		// 	networks: []
		// }
		// // expect(instance.state()).to.be.a(expected);
		// await expect(instance.state()).to.eventually.become(expected);
		// await expect(instance.myFunc()).to.eventually.become(
		// 	`I need implementing! 1`,
		// );
	});
});

/* Update Scenarios TODO:

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

*/
