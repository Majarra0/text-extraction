import { writable } from 'svelte/store';

type NotificationIntent = 'success' | 'error';

export type Notification = {
	id: string;
	message: string;
	intent: NotificationIntent;
	duration?: number;
};

const DEFAULT_DURATION = 4000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function createNotificationsStore() {
	const { subscribe, update } = writable<Notification[]>([]);

	function addNotification(params: { message: string; intent?: NotificationIntent; duration?: number }) {
		const { message, intent = 'success', duration = DEFAULT_DURATION } = params;
		const id =
			typeof crypto !== 'undefined' && 'randomUUID' in crypto
				? crypto.randomUUID()
				: Math.random().toString(36).slice(2);
		const notification: Notification = { id, message, intent, duration };

		update((current) => [...current, notification]);

		if (duration && duration > 0) {
			const timer = setTimeout(() => {
				dismissNotification(id);
			}, duration);
			timers.set(id, timer);
		}

		return id;
	}

	function dismissNotification(id: string) {
		const timer = timers.get(id);
		if (timer) {
			clearTimeout(timer);
			timers.delete(id);
		}
		update((current) => current.filter((item) => item.id !== id));
	}

	function notifySuccess(message: string, duration?: number) {
		return addNotification({ message, duration, intent: 'success' });
	}

	function notifyError(message: string, duration?: number) {
		return addNotification({ message, duration, intent: 'error' });
	}

	return {
		subscribe,
		addNotification,
		dismissNotification,
		notifySuccess,
		notifyError
	};
}

export const notifications = createNotificationsStore();
export const notifySuccess = notifications.notifySuccess;
export const notifyError = notifications.notifyError;
export const dismissNotification = notifications.dismissNotification;
