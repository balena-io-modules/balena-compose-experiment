#!/bin/sh

set -e

project_dir=/usr/src/app


if [ -f "${PWD}/compose.yaml" ]; then
	test_name=$(basename "${PWD}")
	target_state="${project_dir}/test/conformance/${test_name}/target-state.json"
	if [ ! -f "${target_state}" ]; then
		printf "error: target state for ${test_name} not found!\n" >&2
		exit 1
	fi
fi

args="$(echo $@ | sed -e "s|compose.yaml|${target_state}|")"

set -x
exec node /usr/src/app/build/src/index.js ${args}
