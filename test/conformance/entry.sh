#!/bin/sh

docker_is_up() {
	# curl -Ss -o /dev/null --header 'Content-Type: application/json' http://localhost:2376/v1.30/_ping
	docker version -f '{{index .Server.Components 0}}'
}

docker_cleanup() {
	docker container rm -f $(docker container ls -aq) || true
	docker volume prune -f || true
	docker network prune -f || true
}

dockerd >&2 2>/dev/null &

while true
do
	if ! docker_is_up; then
		sleep 2
	else
		break
	fi
done

set -x

(
	/bin/wrapper.sh --version
	docker_cleanup
	make test
)
