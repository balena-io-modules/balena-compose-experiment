# syntax=docker/dockerfile:1.2-labs

FROM node:12.16.2-alpine AS base

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

FROM base AS fix
RUN --mount=src=src,target=src,rw \
    --mount=src=lib,target=lib,rw \
    --mount=src=typings,target=typings,rw \
    --mount=src=test,target=test,rw \
    npm run lint-fix

FROM base AS test
RUN --mount=src=src,target=src,ro \
    --mount=src=lib,target=lib,ro \
    --mount=src=typings,target=typings,ro \
    --mount=src=test,target=test,ro \
    --mount=src=tsconfig.json,target=tsconfig.json,ro \
    --mount=src=tslint.json,target=tslint.json,ro \
     npm run test;

FROM base AS build
RUN \
    --mount=src=src,target=src,ro \
    --mount=src=lib,target=lib,ro \
    --mount=src=typings,target=typings,ro \
    --mount=src=test,target=test,ro \
    --mount=src=tsconfig.json,target=tsconfig.json,ro \
    --mount=src=tslint.json,target=tslint.json,ro \
    npm run build

FROM docker:dind AS conformance
RUN apk update && apk add --no-cache go git make nodejs
WORKDIR /testsuite

RUN set -x; \
		git clone https://github.com/compose-spec/conformance-tests .; \
		rm -v ./commands/docker-compose.yml; \
		rm -v ./commands/compose-ref.yml;

# COPY tests/conformance/testsuite /testsuite

COPY . /usr/src/app/
COPY --from=build /usr/src/app/ /usr/src/app/
COPY test/conformance/balena-compose.yml /testsuite/commands/
COPY test/conformance/wrapper.sh /bin/
COPY test/conformance/entry.sh /bin/
CMD [ "/bin/entry.sh" ]
