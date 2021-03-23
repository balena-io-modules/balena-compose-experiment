
all: check

.PHONY: check
check:
	@env \
	COMPOSE_DOCKER_CLI_BUILD=1 \
	DOCKER_BUILDKIT=1 \
	docker-compose -f test/conformance/docker-compose.yml up --build --abort-on-container-exit --exit-code-from=testsuite

.PHONY: clean
clean:
	@docker-compose -f test/conformance/docker-compose.yml down --volumes

.PHONY: build
build:
	@docker build --target build .
