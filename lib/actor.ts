export type SystemState = {
	label: string;
};

/**
 * An observer is a function to be notified
 * about state changes of an actor's controlled subsystem
 *
 * @param desc description of the change (to be used for logs)
 * @param state updated state of the subsystem
 * @param changes lens into the changes to the state, doing `changes.get(state)` should provide just the subset of changed fields
 */
export type Observer<State extends SystemState> = (
	desc: string,
	state: State,
	changes?: Lens<State>,
) => void;

/**
 * Defines a lens to a part of a data object
 *
 * Lenses should follow lens laws
 *
 * - get-set: lens.set(data, lens.get(data)) = data
 * - set-get: lens.get(lens.set(data, value)) = value
 * - set-set: lens.set(lens.set(data, oldValue), newValue) = newValue
 */
export type Lens<T = any, U = any> = {
	get: (data: T) => U;
	set: (data: T, value: U) => T;
};

// TODO: should this be done with a set of functions to guarantee that actors
// are stateless?
export abstract class Actor<
	State extends SystemState,
	TargetState extends Partial<State>
> {
	protected subscribers: Array<Observer<State>> = [];

	// TODO: figure out types for children
	protected children: Map<string, Actor<any, any>> = new Map();

	constructor(public readonly id: string) {
		// nothing to do here
	}

	// Return current state of the controlled system
	public abstract state(): State;

	// Modify the controlled system to get to the
	// target state
	public abstract update(target: TargetState, intermediate?: boolean): State;

	// Cancel the actor state update operation
	public abstract cancel(): void;

	protected report(desc: string, oldState: State, newState: State): void {
		// TODO: calculate diff between old and new state and report
		// to subscribers
		((..._args) => void 0)(desc, oldState, newState);
	}

	// Subscribe to state changes of the controlled
	// subsystem
	public subscribe(subscriber: Observer<State>) {
		this.subscribers.push(subscriber);
	}

	protected spawn(actor: Actor<any, any>) {
		this.children.set(actor.id, actor);
	}
}
