export enum LogLevel {
	error = 0,
	warn,
	success,
	event,
	api,
	info,
	debug,
}

export type LogListener = (level: LogLevel, msg: string, ...args: any) => void;

export class Log {
	private listeners: LogListener[] = [];

	private log(level: LogLevel, msg: string, ...args: any) {
		this.listeners.forEach((listener) => listener(level, msg, ...args));
	}

	public listen(listener: LogListener) {
		this.listeners.push(listener);
	}

	public info(msg: string, ...args: any) {
		this.log(LogLevel.info, msg, ...args);
	}

	public error(msg: string, ...args: any) {
		this.log(LogLevel.error, msg, ...args);
	}

	public warn(msg: string, ...args: any) {
		this.log(LogLevel.warn, msg, ...args);
	}

	public success(msg: string, ...args: any) {
		this.log(LogLevel.success, msg, ...args);
	}

	public event(msg: string, ...args: any) {
		this.log(LogLevel.event, msg, ...args);
	}

	public api(msg: string, ...args: any) {
		this.log(LogLevel.api, msg, ...args);
	}

	public debug(msg: string, ...args: any) {
		this.log(LogLevel.debug, msg, ...args);
	}
}

const log = new Log();
export default log;
