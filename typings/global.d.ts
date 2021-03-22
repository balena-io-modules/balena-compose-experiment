import type * as Bluebird from 'bluebird';

declare global {
	interface Dictionary<T> {
		[key: string]: T;
	}
	type Nullable<T> = T | null | undefined;
}