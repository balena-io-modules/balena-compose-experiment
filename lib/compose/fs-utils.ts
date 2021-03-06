import * as Bluebird from 'bluebird';
import * as _ from 'lodash';
import { fs } from 'mz';
import * as Path from 'path';
import constants from '../constants';
import { ENOENT } from '../errors';

export function writeAndSyncFile(
	path: string,
	data: string | Buffer,
): Bluebird<void> {
	return Bluebird.resolve(fs.open(path, 'w')).then((fd) => {
		_.isString(data)
			? fs.write(fd, data, 0, 'utf8')
			: fs
					.write(fd, data, 0, data.length)
					.then(() => fs.fsync(fd))
					.then(() => fs.close(fd));
	});
}

export function writeFileAtomic(
	path: string,
	data: string | Buffer,
): Bluebird<void> {
	return Bluebird.resolve(writeAndSyncFile(`${path}.new`, data)).then(() =>
		fs.rename(`${path}.new`, path),
	);
}

export function safeRename(src: string, dest: string): Bluebird<void> {
	return Bluebird.resolve(fs.rename(src, dest))
		.then(() => fs.open(Path.dirname(dest), 'r'))
		.tap(fs.fsync)
		.then(fs.close);
}

export function pathExistsOnHost(p: string): Bluebird<boolean> {
	return Bluebird.resolve(fs.stat(Path.join(constants.rootMountPoint, p)))
		.return(true)
		.catchReturn(ENOENT, false);
}
