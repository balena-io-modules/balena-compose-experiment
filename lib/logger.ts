import { LogType } from './log-types';
import log from './console';
import * as _ from 'lodash';

type LogEventObject = Dictionary<any> | null;

function objectNameForLogs(eventObj: LogEventObject): string | null {
	if (eventObj == null) {
		return null;
	}
	if (
		eventObj.service != null &&
		eventObj.service.serviceName != null &&
		eventObj.service.config != null &&
		eventObj.service.config.image != null
	) {
		return `${eventObj.service.serviceName} ${eventObj.service.config.image}`;
	}

	if (eventObj.image != null) {
		return eventObj.image.name;
	}

	if (eventObj.network != null && eventObj.network.name != null) {
		return eventObj.network.name;
	}

	if (eventObj.volume != null && eventObj.volume.name != null) {
		return eventObj.volume.name;
	}

	if (eventObj.fields != null) {
		return eventObj.fields.join(',');
	}

	return null;
}

export function logSystemMessage(
	message: string,
	eventObj?: LogEventObject,
	_eventName?: string,
	_track: boolean = true,
) {
	if (eventObj != null && eventObj.error != null) {
		log.error(message);
	} else {
		log.event(message);
	}
}

export function logSystemEvent(
	logType: LogType,
	obj: LogEventObject,
	track: boolean = true,
): void {
	let message = logType.humanName;
	const objectName = objectNameForLogs(obj);
	if (objectName != null) {
		message += ` '${objectName}'`;
	}
	if (obj && obj.error != null) {
		let errorMessage = obj.error.message;
		if (_.isEmpty(errorMessage)) {
			errorMessage =
				obj.error.name !== 'Error' ? obj.error.name : 'Unknown cause';
			log.warn('Invalid error message', obj.error);
		}
		message += ` due to '${errorMessage}'`;
	}
	logSystemMessage(message, obj, logType.eventName, track);
}

export function attach(
	_containerId: string,
	_serviceInfo: { serviceId: number; imageId: number },
): void {
	// TODO: decide how the container logs can be attached to the
	// calling sevice
	// console.log(`logger.attach called with ${containerId}`);
	// console.log(serviceInfo);
}
