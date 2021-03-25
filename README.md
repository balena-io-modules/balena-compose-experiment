# Balena Compose

Balena compose is a [Node.js](https://nodejs.org/en/) library (and CLI tool) to define, run and update
multi-container applications on Docker enabled devices. It is specially targeted
for managing the lifecycle [Balena](https://www.balena.io) applications on edge
devices. This means it adds some features to [docker-compose](https://github.com/docker/compose) that
make it more compatible with edge devices.

- Support for [Balena Engine](https://www.balena.io/engine/) Docker daemon for more conservative
  memory use and reduced bandwidth use when pulling new images through the use of
  [image deltas](https://www.balena.io/docs/learn/deploy/delta/#delta-updates).
- Better control of [service update strategy](https://www.balena.io/docs/learn/deploy/release-strategy/update-strategies/#controlling-the-update-strategy)
  to optimize for device constraints.
- Application controlled updates through the use of [application update locks](https://www.balena.io/docs/learn/deploy/release-strategy/update-locking/#application-update-locks)
  for critical sections of code.

Balena compose is (will be) used by [Balena Supervisor](https://github.com/balena-io/balena-supervisor/),
Balena's on-device agent for managing a single application lifecycle.

# Setup

- `git clone https://github.com/balena-io-playground/balena-compose`
- `npm i`
- `npm run build`

# Using the CLI

```
# Updates the application with the given name on the device.
# Configuration is obtained fom config.json and state info
# is obtained from the state endpoint on the cloud
$ npm run compose -- up -a <appName>
```

# Using the library

```typescript
import { Composer } from '@balena/compose';

// Construct a new composer for app id (soon to be changed to app uuid)
const composer = new Composer('12345', { 
  uuid: 'deadbeef',
  deviceApiKey: 'abcdef',
  });


// Returns the current container state and version of the app
// with version 12345 (it looks for containers with `io.balena.app=12345`
// if no app exists, it will return
// {status: "Idle", services: {}, networks: {}, volumes: {}}
await composer.state();

// Set the target state for commit 'deafbeef' of the app (soon to be replaced by release-version),
// see format of a single app in the target state endpoint
// this will throw if the composer cannot reach the target state (there is a lock, cannot fetch images, etc.)
// while this process is taking place, composer.state() should return the state of the application
// install
await composer.update('deadbeef', {services: {main: {...}}, volumes: {}, networks: {}})

// If everything went well this should return the new state of the composer
await composer.state();
```


# Hack week

The main goal of the hack week project is to get to an agreement on what functionality this
library and CLI should provide.

Although most of the code that will provide the functionalityof this library is already in the current supervisor codebase,
(see [compose/](https://github.com/balena-io/balena-supervisor/tree/master/src/compose)), a secondary goal is to simplify
and adapt this code to the requirements defined for this library.

## Tasks (non-exhaustive)

- [x] Setup typescript repo
- [ x] Extract and review typescript types for `Composer`, `Service`, `Volume` and `Network` from supervisor codebase
- [x] Define public APIs for the libraries
- [-] Write tests to specify API behavior
  - [x] Improve [dockerode test mock](https://github.com/balena-io/balena-supervisor/blob/78821824ad4395502be498b696acf0f57ccd65d0/test/lib/mocked-dockerode.ts).
- [x] Write/adapt modules for
  - [x] Composer
  - [x] Services
  - [x] Volumes
  - [x] Networks
  - [x] Logging
  - [x] Contract validation
  - [x] Delta management
  - [x] Update locks
- [x] Write CLI

## Code Improvement goals

- Improve test coverage
- Remove code for legacy use cases, e.g. v2 deltas, legacy labels.
- Reduce the need for additional storage for current state, which forces to synchronize
  multiple sources of truth. Whenever possible, application meta data should be stored
  on docker labels.
- Improve code typing, avoid using `as any` as much as possible.
- Improve module isolation and external state manipulation
- Reduce the need for external dependencies whenever possible.
- Look for ways to make code more declarative

# Future goals

Support compose the compose specification https://compose-spec.io/
