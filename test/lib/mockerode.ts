import * as dockerode from 'dockerode';
import * as _ from 'lodash';
import * as sinon from 'sinon';

// Recursively convert properties of an object as optional
type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends Array<infer U>
		? Array<DeepPartial<U>>
		: T[P] extends object
		? DeepPartial<T[P]>
		: T[P];
};

// Partial container inspect info for receiving as testing data
export type PartialContainerInspectInfo = DeepPartial<dockerode.ContainerInspectInfo> & {
	Id: string;
};

export type PartialNetworkInspectInfo = DeepPartial<dockerode.NetworkInspectInfo> & {
	Id: string;
};

export type PartialVolumeInspectInfo = DeepPartial<dockerode.VolumeInspectInfo> & {
	Id: string;
};

export type PartialImageInspectInfo = DeepPartial<dockerode.ImageInspectInfo> & {
	Id: string;
};

export class MockNetwork {
	stubs = {
		inspect: sinon.stub().resolves(this.info),
		remove: sinon.stub().callsFake(() => {
			// Remove the network from the engine state
			delete this.engine.networks[this.id];

			Promise.resolve(true);
		}),
	};

	private constructor(
		readonly id: string,
		readonly info: dockerode.NetworkInspectInfo,
		readonly engine: MockEngine,
	) {}

	static fromPartial(network: PartialNetworkInspectInfo, engine: MockEngine) {
		const { Id, ...networkInspect } = network;
		const networkInfo = {
			Id,
			Name: 'default',
			Created: '2015-01-06T15:47:31.485331387Z',
			Scope: 'local',
			Driver: 'bridge',
			EnableIPv6: false,
			Internal: false,
			Attachable: true,
			Ingress: false,
			IPAM: {
				Driver: 'default',
				Options: {},
				Config: [
					{
						Subnet: '172.18.0.0/16',
						Gateway: '172.18.0.1',
					},
				],
			},
			Containers: {},
			Options: {},
			Labels: {},

			// Add defaults
			...networkInspect,
		};

		return new MockNetwork(Id, networkInfo, engine);
	}

	get inspect(): () => Promise<dockerode.NetworkInspectInfo> {
		return this.stubs.inspect;
	}

	get remove(): () => Promise<void> {
		return this.stubs.remove;
	}
}

export class MockContainer {
	private constructor(
		readonly id: string,
		readonly info: dockerode.ContainerInspectInfo,
	) {}

	// Create function stubs to keep track of call history
	stubs = {
		inspect: sinon.stub(),
	};

	/**
	 * Create a mock container from a partial container inspect info.
	 *
	 * This fills out the inspectinfo with reasonable defaults
	 */
	static fromPartial(container: PartialContainerInspectInfo) {
		const {
			Id,
			State,
			Config,
			NetworkSettings,
			HostConfig,
			...ContainerInfo
		} = container;

		const containerInfo = {
			Id,
			Created: '2015-01-06T15:47:31.485331387Z',
			Path: '/usr/bin/sleep',
			Args: ['infinity'],
			State: {
				Status: 'running',
				ExitCode: 0,
				Running: true,
				Paused: false,
				Restarting: false,
				OOMKilled: false,
				...State, // User passed options
			},
			Image: 'deadbeef',
			Name: 'main',
			HostConfig: {
				AutoRemove: false,
				Binds: [],
				LogConfig: {
					Type: 'journald',
					Config: {},
				},
				NetworkMode: 'bridge',
				PortBindings: {},
				RestartPolicy: {
					Name: 'always',
					MaximumRetryCount: 0,
				},
				VolumeDriver: '',
				CapAdd: [],
				CapDrop: [],
				Dns: [],
				DnsOptions: [],
				DnsSearch: [],
				ExtraHosts: [],
				GroupAdd: [],
				IpcMode: 'shareable',
				Privileged: false,
				SecurityOpt: [],
				ShmSize: 67108864,
				Memory: 0,
				MemoryReservation: 0,
				OomKillDisable: false,
				Devices: [],
				Ulimits: [],
				...HostConfig, // User passed options
			},
			Config: {
				Hostname: Id,
				Labels: {},
				Cmd: ['/usr/bin/sleep', 'infinity'],
				Env: [] as string[],
				Volumes: {},
				Image: 'alpine:latest',
				...Config, // User passed options
			},
			NetworkSettings: {
				Networks: {
					default: {
						Aliases: [],
						Gateway: '172.18.0.1',
						IPAddress: '172.18.0.2',
						IPPrefixLen: 16,
						MacAddress: '00:00:de:ad:be:ef',
					},
				},
				...NetworkSettings, // User passed options
			},

			...ContainerInfo,
		} as dockerode.ContainerInspectInfo;

		return new MockContainer(Id, containerInfo);
	}

	/**
	 * Return summarized container info from the internal inspect info object
	 *
	 * This is not a Dockerode.Container method. This is an utility method to
	 * get the container data for the listContainers method
	 */
	get summary(): dockerode.ContainerInfo {
		const {
			Id,
			Name,
			Created,
			Image,
			State,
			HostConfig,
			Config,
			Mounts,
			NetworkSettings,
		} = this.info;

		const capitalizeFirst = (s: string) =>
			s.charAt(0).toUpperCase() + s.slice(1);

		// Calculate summary from existing inspectInfo object
		return {
			Id,
			Names: [Name],
			ImageID: Image,
			Image: Config.Image,
			Created: Date.parse(Created),
			Command: Config.Cmd.join(' '),
			State: capitalizeFirst(State.Status),
			Status: `Exit ${State.ExitCode}`,
			HostConfig: {
				NetworkMode: HostConfig.NetworkMode!,
			},
			Ports: [],
			Labels: Config.Labels,
			NetworkSettings: {
				Networks: NetworkSettings.Networks,
			},
			Mounts: Mounts as dockerode.ContainerInfo['Mounts'],
		};
	}

	get inspect() {
		// Return the stub so tests can redefine the result
		return this.stubs.inspect.resolves(this.info);
	}
}

export type MockEngineState = {
	containers?: PartialContainerInspectInfo[];
	networks?: PartialNetworkInspectInfo[];
	volumes?: PartialVolumeInspectInfo[];
	images?: PartialImageInspectInfo[];
};

// Good enough function go generate ids for mock engine
// source: https://stackoverflow.com/a/2117523
function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		// tslint:disable
		const r = (Math.random() * 16) | 0,
			v = c == 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

class MockEngine {
	containers: Dictionary<MockContainer> = {};
	networks: Dictionary<MockNetwork> = {};

	constructor(
		initialState: MockEngineState = {
			containers: [],
			networks: [],
			volumes: [],
			images: [],
		},
	) {
		// Clone the initial data so we can modify it without affecting the
		// original data
		initialState = _.cloneDeep(initialState);

		// Initialize to empty arrays if no data is given
		initialState.containers = initialState.containers ?? [];
		initialState.networks = initialState.networks ?? [];
		initialState.volumes = initialState.volumes ?? [];
		initialState.images = initialState.images ?? [];

		// Key list of containers by Id and add defaults
		this.containers = initialState.containers.reduce((result, container) => {
			const { Id } = container;
			return { ...result, [Id]: MockContainer.fromPartial(container) };
		}, {});

		// Key list of networks by Id and add defaults
		this.networks = initialState.networks.reduce((result, network) => {
			const { Id } = network;
			return { ...result, [Id]: MockNetwork.fromPartial(network, this) };
		}, {});

		// TODO: do the same conversion for volumes and images
	}

	listContainers() {
		Promise.resolve(
			// List containers returns ContainerInfo objects so we convert from ContainerInspectInfo
			Object.values(this.containers).map((container) => container.summary),
		);
	}

	getContainer(id: string) {
		const container = Object.values(this.containers).find(
			(c) => c.info.Id === id || c.info.Name === id,
		);

		if (!container) {
			return {
				id,
				inspect: () => Promise.reject(`No such container ${id}`),
			} as MockContainer;
		}

		return container;
	}

	getNetwork(id: string) {
		const network = Object.values(this.networks).find(
			(n) => n.info.Id === id || n.info.Name === id,
		);

		if (!network) {
			return {
				id,
				inspect: () => Promise.reject(`No such network ${id}`),
				remove: () => Promise.reject(`No such network ${id}`),
			} as MockNetwork;
		}

		return network;
	}

	listNetworks() {
		return Promise.resolve(
			Object.values(this.networks).map((network) => network.info),
		);
	}

	createNetwork(options: dockerode.NetworkCreateOptions) {
		const Id = uuidv4();
		const network = MockNetwork.fromPartial({ Id, ...options }, this);

		// Add network to list
		this.networks[Id] = network;
	}
}

// Utility type to create a record of stubs from an object
type Stubbed<T> = {
	[K in keyof T]: T[K] extends (...args: infer TArgs) => infer TReturnValue
		? sinon.SinonStub<TArgs, TReturnValue>
		: never;
};

// The mockerode type is a collection of stubs
export type Mockerode = Stubbed<dockerode>;

export async function withMockerode(
	test: (dockerode: Mockerode) => Promise<any>,
	initialState: MockEngineState = {
		containers: [],
		networks: [],
		volumes: [],
		images: [],
	},
) {
	const mockEngine = new MockEngine(initialState);

	// Remember overriden functions
	const mockerode = Object.getOwnPropertyNames(dockerode.prototype).reduce(
		(stubs, fn) => {
			if (
				fn !== 'constructor' &&
				typeof (dockerode.prototype as any)[fn] === 'function'
			) {
				// Create a stub for the given function
				const stub = sinon.stub(dockerode.prototype, fn as keyof Mockerode);
				if (fn in mockEngine) {
					// Call the mockerode implementation as fake if it exists
					stub.callsFake((mockEngine as any)[fn].bind(mockEngine));
				} else {
					// Reject calls to any not implemented function
					// this will allow us to identify what is missing
					stub.rejects(`🐳 not implemented: ${fn}`);
				}

				return {
					...stubs,
					[fn]: stub,
				};
			}
			return stubs;
		},
		{} as Mockerode,
	);

	try {
		await test(mockerode);
	} finally {
		// Restore overriden functions
		Object.values(mockerode).forEach((stub) => {
			stub.restore();
		});

		// Reset behavior and history for all stubs
		sinon.reset();
	}
}
