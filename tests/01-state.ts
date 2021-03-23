import { expect } from './chai';
import { Composer, ComposerOptions, ComposerState } from '../lib/index';
import { testWithData } from './mocked-dockerode';
// import { Volume } from 'dockerode'

describe('TypeScript library skeleton:', function () {
	it('should be able to call myFunc on a new instance', async function () {
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

		const expected: ComposerState = {
			status: 'idle',
			app: 123,
			volumes: {},
			networks: {},
			services: {},
		};

		testWithData({ containers: [] }, async () => {
			await expect(instance.state()).to.eventually.become(expected);
		});
	});
});
