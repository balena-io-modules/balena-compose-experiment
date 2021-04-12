import { expect } from '../chai';
import * as sinon from 'sinon';
import { NetworkInspectInfo } from 'dockerode';
import * as mockerode from '../lib/mockerode';

import { Network } from '../../lib/compose/network';

describe('Network', () => {
	describe('fromComposeObject', () => {
		it('creates a default network configuration if no config is given', () => {
			const network = Network.fromComposeObject('default', 12345, {});

			expect(network.name).to.equal('default');
			expect(network.appId).to.equal(12345);

			// Default configuration options
			expect(network.config.driver).to.equal('bridge');
			expect(network.config.ipam).to.deep.equal({
				driver: 'default',
				config: [],
				options: {},
			});
			expect(network.config.enableIPv6).to.equal(false);
			expect(network.config.labels).to.deep.equal({});
			expect(network.config.options).to.deep.equal({});
		});

		it('normalizes legacy labels', () => {
			const network = Network.fromComposeObject('default', 12345, {
				labels: {
					'io.resin.features.something': '1234',
				},
			});

			expect(network.config.labels).to.deep.equal({
				'io.balena.features.something': '1234',
			});
		});

		it('accepts valid IPAM configurations', () => {
			const network0 = Network.fromComposeObject('default', 12345, {
				ipam: { driver: 'dummy', config: [], options: {} },
			});

			// Default configuration options
			expect(network0.config.ipam).to.deep.equal({
				driver: 'dummy',
				config: [],
				options: {},
			});

			const network1 = Network.fromComposeObject('default', 12345, {
				ipam: {
					driver: 'default',
					config: [
						{
							subnet: '172.20.0.0/16',
							ip_range: '172.20.10.0/24',
							aux_addresses: { host0: '172.20.10.15', host1: '172.20.10.16' },
							gateway: '172.20.0.1',
						},
					],
					options: {},
				},
			});

			// Default configuration options
			expect(network1.config.ipam).to.deep.equal({
				driver: 'default',
				config: [
					{
						subnet: '172.20.0.0/16',
						ipRange: '172.20.10.0/24',
						gateway: '172.20.0.1',
						auxAddress: { host0: '172.20.10.15', host1: '172.20.10.16' },
					},
				],
				options: {},
			});
		});

		it('rejects IPAM configuration without both gateway and subnet', () => {
			expect(() =>
				Network.fromComposeObject('default', 12345, {
					ipam: {
						driver: 'default',
						config: [
							{
								subnet: '172.20.0.0/16',
							},
						],
						options: {},
					},
				}),
			).to.throw(
				'Network IPAM config entries must have both a subnet and gateway',
			);

			expect(() =>
				Network.fromComposeObject('default', 12345, {
					ipam: {
						driver: 'default',
						config: [
							{
								gateway: '172.20.0.1',
							},
						],
						options: {},
					},
				}),
			).to.throw(
				'Network IPAM config entries must have both a subnet and gateway',
			);
		});
	});

	describe('fromDockerNetwork', () => {
		it('rejects networks without the proper name format', () => {
			expect(() =>
				Network.fromDockerNetwork({
					Id: 'deadbeef',
					Name: 'abcd',
				} as NetworkInspectInfo),
			).to.throw();

			expect(() =>
				Network.fromDockerNetwork({
					Id: 'deadbeef',
					Name: 'abcd_1234',
				} as NetworkInspectInfo),
			).to.throw();

			expect(() =>
				Network.fromDockerNetwork({
					Id: 'deadbeef',
					Name: 'abcd_abcd',
				} as NetworkInspectInfo),
			).to.throw();

			expect(() =>
				Network.fromDockerNetwork({
					Id: 'deadbeef',
					Name: '1234',
				} as NetworkInspectInfo),
			).to.throw();
		});

		it('creates a network object from a docker network configuration', () => {
			const network = Network.fromDockerNetwork({
				Id: 'deadbeef',
				Name: '1234_default',
				Driver: 'bridge',
				EnableIPv6: true,
				IPAM: {
					Driver: 'default',
					Options: {},
					Config: [
						{
							Subnet: '172.18.0.0/16',
							Gateway: '172.18.0.1',
						},
					],
				} as NetworkInspectInfo['IPAM'],
				Internal: true,
				Containers: {},
				Options: {
					'com.docker.some-option': 'abcd',
				} as NetworkInspectInfo['Options'],
				Labels: {
					'io.balena.features.something': '123',
				} as NetworkInspectInfo['Labels'],
			} as NetworkInspectInfo);

			expect(network.appId).to.equal(1234);
			expect(network.name).to.equal('default');
			expect(network.config.enableIPv6).to.equal(true);
			expect(network.config.ipam.driver).to.equal('default');
			expect(network.config.ipam.options).to.deep.equal({});
			expect(network.config.ipam.config).to.deep.equal([
				{
					subnet: '172.18.0.0/16',
					gateway: '172.18.0.1',
				},
			]);
			expect(network.config.internal).to.equal(true);
			expect(network.config.options).to.deep.equal({
				'com.docker.some-option': 'abcd',
			});
			expect(network.config.labels).to.deep.equal({
				'io.balena.features.something': '123',
			});
		});

		it('normalizes legacy label names and excludes supervised label', () => {
			const network = Network.fromDockerNetwork({
				Id: 'deadbeef',
				Name: '1234_default',
				IPAM: {
					Driver: 'default',
					Options: {},
					Config: [],
				} as NetworkInspectInfo['IPAM'],
				Labels: {
					'io.resin.features.something': '123',
					'io.balena.features.dummy': 'abc',
					'io.balena.supervised': 'true',
				} as NetworkInspectInfo['Labels'],
			} as NetworkInspectInfo);

			expect(network.config.labels).to.deep.equal({
				'io.balena.features.something': '123',
				'io.balena.features.dummy': 'abc',
			});
		});
	});

	describe('toComposeObject', () => {
		it('creates a docker compose network object from the internal network config', () => {
			const network = Network.fromDockerNetwork({
				Id: 'deadbeef',
				Name: '1234_default',
				Driver: 'bridge',
				EnableIPv6: true,
				IPAM: {
					Driver: 'default',
					Options: {},
					Config: [
						{
							Subnet: '172.18.0.0/16',
							Gateway: '172.18.0.1',
						},
					],
				} as NetworkInspectInfo['IPAM'],
				Internal: true,
				Containers: {},
				Options: {
					'com.docker.some-option': 'abcd',
				} as NetworkInspectInfo['Options'],
				Labels: {
					'io.balena.features.something': '123',
				} as NetworkInspectInfo['Labels'],
			} as NetworkInspectInfo);

			// Convert to compose object
			const compose = network.toComposeObject();
			expect(compose.driver).to.equal('bridge');
			expect(compose.driver_opts).to.deep.equal({
				'com.docker.some-option': 'abcd',
			});
			expect(compose.enable_ipv6).to.equal(true);
			expect(compose.internal).to.equal(true);
			expect(compose.ipam).to.deep.equal({
				driver: 'default',
				options: {},
				config: [
					{
						subnet: '172.18.0.0/16',
						gateway: '172.18.0.1',
					},
				],
			});
			expect(compose.labels).to.deep.equal({
				'io.balena.features.something': '123',
			});
		});
	});

	describe('generateDockerName', () => {
		it('creates a proper network name from the user given name and the app id', () => {
			expect(Network.generateDockerName(12345, 'default')).to.equal(
				'12345_default',
			);
			expect(Network.generateDockerName(12345, 'bleh')).to.equal('12345_bleh');
			expect(Network.generateDockerName(1, 'default')).to.equal('1_default');
		});
	});

	describe('create', () => {
		it('creates a new network on the engine with the given data', async () => {
			await mockerode.withMockerode(async (dockerode) => {
				const network = Network.fromComposeObject('default', 12345, {
					ipam: {
						driver: 'default',
						config: [
							{
								subnet: '172.20.0.0/16',
								ip_range: '172.20.10.0/24',
								gateway: '172.20.0.1',
							},
						],
						options: {},
					},
				});

				// Create the network
				await network.create();

				// Check that the create function was called with proper arguments
				expect(dockerode.createNetwork).to.be.calledOnce;
				expect(dockerode.createNetwork.args[0][0]).to.deep.equal({
					Name: '12345_default',
					Driver: 'bridge',
					CheckDuplicate: true,
					IPAM: {
						Driver: 'default',
						Config: [
							{
								Subnet: '172.20.0.0/16',
								IPRange: '172.20.10.0/24',
								Gateway: '172.20.0.1',
							},
						],
						Options: {},
					},
					EnableIPv6: false,
					Internal: false,
					Labels: {
						'io.balena.supervised': 'true',
					},
				});
			});
		});

		it('throws the error if an engine failure occurs', async () => {
			await mockerode.withMockerode(async (dockerode) => {
				const network = Network.fromComposeObject('default', 12345, {
					ipam: {
						driver: 'default',
						config: [
							{
								subnet: '172.20.0.0/16',
								ip_range: '172.20.10.0/24',
								gateway: '172.20.0.1',
							},
						],
						options: {},
					},
				});

				// Re-stub the dockerode.createNetwork to throw
				dockerode.createNetwork.rejects('Unknown engine error');

				// Creating the network should fail
				return expect(network.create()).to.be.rejected.then((error) =>
					expect(error).to.have.property('name', 'Unknown engine error'),
				);
			});
		});
	});

	describe('remove', () => {
		it('removes the network from the engine if it exists', async () => {
			// Create a mock network to add to the mock engine
			const mockNetwork = {
				Id: 'deadbeef',
				Name: '12345_default',
				Driver: 'bridge',
			};

			await mockerode.withMockerode(
				async (dockerode) => {
					// Check that the engine has the network
					expect(await dockerode.listNetworks()).to.have.lengthOf(1);

					const dockerNetwork = dockerode.getNetwork('deadbeef');
					expect((await dockerNetwork.inspect()).Name).to.equal(
						'12345_default',
					);

					// Create a dummy network object
					const network = Network.fromComposeObject('default', 12345, {});

					await network.remove();

					// The removal step should delete the object from the engine data
					expect(await dockerode.listNetworks()).to.have.lengthOf(0);
					expect(dockerNetwork.remove).to.have.been.calledOnce;
				},
				{ networks: [mockNetwork] },
			);
		});

		it('ignores the request if the given network does not exist on the engine', async () => {
			// Create a mock network to add to the mock engine
			const mockNetwork = {
				Id: 'deadbeef',
				Name: 'some_network',
				Driver: 'bridge',
			};

			await mockerode.withMockerode(
				async (dockerode) => {
					// Check that the engine has the network
					expect(await dockerode.listNetworks()).to.have.lengthOf(1);

					// Create a dummy network object
					const network = Network.fromComposeObject('default', 12345, {});

					// This should not fial
					await expect(network.remove()).to.not.be.rejected;

					// We expect the network state to remain constant
					expect(await dockerode.listNetworks()).to.have.lengthOf(1);
				},
				{ networks: [mockNetwork] },
			);
		});

		it('throws the error if there is a problem while removing the network', async () => {
			// Create a mock network to add to the mock engine
			const mockNetwork = {
				Id: 'deadbeef',
				Name: '12345_default',
				Driver: 'bridge',
			};

			await mockerode.withMockerode(
				async (dockerode) => {
					// Configure the network removal to fail
					const dockerNetwork = dockerode.getNetwork('deadbeef');
					(dockerNetwork.remove as sinon.SinonStub).rejects('Unknown error');

					// Create a dummy network object
					const network = Network.fromComposeObject('default', 12345, {});

					// This should fail
					// TODO: re-think this, should this really throw an error? What
					// are the consequences of an network failing to remove?
					// what if the error is 'network not found' due to some race condition?
					// where the network is actually no longer available
					await expect(network.remove()).to.be.rejected;
				},
				{ networks: [mockNetwork] },
			);
		});
	});

	describe('isEqualConfig', () => {
		it('ignores IPAM configuration', () => {
			const network = Network.fromComposeObject('default', 12345, {
				ipam: {
					driver: 'default',
					config: [
						{
							subnet: '172.20.0.0/16',
							ip_range: '172.20.10.0/24',
							gateway: '172.20.0.1',
						},
					],
					options: {},
				},
			});
			expect(
				network.isEqualConfig(Network.fromComposeObject('default', 12345, {})),
			).to.be.true;

			// Only ignores ipam.config, not other ipam elements
			expect(
				network.isEqualConfig(
					Network.fromComposeObject('default', 12345, {
						ipam: { driver: 'aaa' },
					}),
				),
			).to.be.false;
		});

		it('compares configurations recursively', () => {
			expect(
				Network.fromComposeObject('default', 12345, {}).isEqualConfig(
					Network.fromComposeObject('default', 12345, {}),
				),
			).to.be.true;
			expect(
				Network.fromComposeObject('default', 12345, {
					driver: 'default',
				}).isEqualConfig(Network.fromComposeObject('default', 12345, {})),
			).to.be.false;
			expect(
				Network.fromComposeObject('default', 12345, {
					enable_ipv6: true,
				}).isEqualConfig(Network.fromComposeObject('default', 12345, {})),
			).to.be.false;
			expect(
				Network.fromComposeObject('default', 12345, {
					enable_ipv6: false,
					internal: false,
				}).isEqualConfig(
					Network.fromComposeObject('default', 12345, { internal: true }),
				),
			).to.be.false;
		});
	});
});
