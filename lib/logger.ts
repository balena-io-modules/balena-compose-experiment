import { LogType } from './log-types';

type LogEventObject = Dictionary<any> | null;

export function logSystemEvent(
	logType: LogType,
	obj: LogEventObject,
	_track: boolean = true,
): void {
    // TODO: connect to backend at some point
    const message = logType.humanName;
	console.log(message, obj);
}

export function attach(
	containerId: string,
	serviceInfo: { serviceId: number; imageId: number },
): void {
	console.log(`logger.attach called with ${containerId}`);
	console.log(serviceInfo);
}
