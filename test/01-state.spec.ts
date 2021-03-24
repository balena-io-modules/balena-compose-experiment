import { expect } from './chai';
import { Composer, ComposerOptions, ComposerState } from '../lib/index';
import { testWithData } from './mocked-dockerode';
// import { Service } from 'dockerode';
// import * as dockerode from 'dockerode';

describe('Composer state:', function () {
	it('should be able to get state for device with no services', async function () {
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
			services: {},
			networks: {},
			volumes: {},
		};

		await testWithData({}, async () => {
			await expect(instance.state()).to.eventually.deep.equal(expected);
		});
	});

	it('should be able to get state for device with services', async function () {
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

		const instance = new Composer(789, options);

		const containers = [
			{
				Id: '789',
				Name: 'something_123_123',
				State: {
					Running: true,
				},
				Config: {
					Hostname: 'hostymc-hostface',
					Labels: {
						'io.balena.app-id': '789',
						'io.balena.service-name': 'testitnow',
						'io.balena.service-id': 1,
					},
				},
				HostConfig: {
					Ulimits: [],
				},
			},
		];

		const expected = {
			status: 'idle',
			app: 789,
			volumes: {},
			networks: {},
			services: { appId: '789' },
		};

		await testWithData({ containers }, async () => {
			await expect(instance.state()).to.eventually.deep.equal(expected);
		});
	});
});
