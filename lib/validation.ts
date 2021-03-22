import * as _ from 'lodash'

export interface CheckIntOptions {
	positive?: boolean;
}

const TRUTHY = ['1', 'true', true, 'on', 1];
const NUMERALS_REGEX = /^-?[0-9]+\.?0*$/; // Allows trailing 0 decimals

/**
 * checkInt
 *
 * Check an input string as a number, optionally specifying a requirement
 * to be positive
 */
 export function checkInt(
	s: unknown,
	options: CheckIntOptions = {},
): number | undefined {
	// Check for non-numeric characters
	if (!NUMERALS_REGEX.test(s as string)) {
		return;
	}

	const i = Number(s);

	if (!Number.isInteger(i)) {
		return;
	}

	if (options.positive && i <= 0) {
		return;
	}

	return i;
}


/**
 * checkString
 *
 * Check that a string exists, and is not an empty string, 'null', or 'undefined'
 */
 export function checkString(s: unknown): string | void {
	if (s == null || !_.isString(s) || _.includes(['null', 'undefined', ''], s)) {
		return;
	}

	return s;
}

/**
 * checkTruthy
 *
 * Given an unknown value, determine if it evaluates to true.
 *
 */
 export function checkTruthy(v: unknown): boolean {
	if (typeof v === 'string') {
		v = v.toLowerCase();
	}
	return TRUTHY.includes(v as any);
}

export function isValidDeviceName(name: string): boolean {
	// currently the only disallowed value in a device name is a newline
	return name.indexOf('\n') === -1;
}
