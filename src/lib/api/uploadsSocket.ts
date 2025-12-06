import { buildWebSocketUrl } from '$lib/config';

export const UPLOADS_SOCKET_PATH = '/ws/core/upload/';
export const DEFAULT_UPLOAD_SOCKET_TIMEOUT = 5000;

export type UploadSocketCommand =
	| { type: 'subscribe' }
	| { type: 'list' }
	| { type: 'retrieve'; instance_id: string }
	| { type: 'delete'; instance_id: string }
	| { type: 'create'; data: Record<string, unknown> }
	| { type: 'update'; instance_id: string; data: Record<string, unknown> }
	| { type: 'question'; instance_id: string; question: string };

export const UploadSocketCommands = {
	subscribe(): UploadSocketCommand {
		return { type: 'subscribe' };
	},
	list(): UploadSocketCommand {
		return { type: 'list' };
	},
	retrieve(instanceId: string): UploadSocketCommand {
		return { type: 'retrieve', instance_id: instanceId };
	},
	update(instanceId: string, data: Record<string, unknown>): UploadSocketCommand {
		return { type: 'update', instance_id: instanceId, data };
	},
	delete(instanceId: string): UploadSocketCommand {
		return { type: 'delete', instance_id: instanceId };
	},
	create(data: Record<string, unknown>): UploadSocketCommand {
		return { type: 'create', data };
	},
	question(instanceId: string, question: string): UploadSocketCommand {
		return { type: 'question', instance_id: instanceId, question };
	}
} as const;

export function createUploadsWebSocket(token: string, path = UPLOADS_SOCKET_PATH) {
	const wsUrl = buildWebSocketUrl(path, { token });
	return new WebSocket(wsUrl);
}

export function waitForUploadsSocketOpen(
	socket: WebSocket,
	timeoutMs = DEFAULT_UPLOAD_SOCKET_TIMEOUT
) {
	return new Promise<WebSocket>((resolve, reject) => {
		if (!socket) {
			reject(new Error('Uploads websocket is unavailable.'));
			return;
		}
		if (socket.readyState === WebSocket.OPEN) {
			resolve(socket);
			return;
		}
		if (socket.readyState !== WebSocket.CONNECTING) {
			reject(new Error('Uploads websocket is not connected.'));
			return;
		}

		let settled = false;
		const handleSuccess = () => {
			if (settled) return;
			settled = true;
			cleanup();
			resolve(socket);
		};
		const handleFailure = () => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(new Error('Uploads websocket closed before it was ready.'));
		};
		const cleanup = () => {
			clearTimeout(timeout);
			socket.removeEventListener?.('open', handleSuccess);
			socket.removeEventListener?.('error', handleFailure);
			socket.removeEventListener?.('close', handleFailure);
		};
		const timeout = setTimeout(() => {
			handleFailure();
		}, timeoutMs);

		socket.addEventListener?.('open', handleSuccess, { once: true });
		socket.addEventListener?.('error', handleFailure, { once: true });
		socket.addEventListener?.('close', handleFailure, { once: true });
	});
}

export async function ensureUploadsSocketReady(
	socket: WebSocket | null,
	timeoutMs = DEFAULT_UPLOAD_SOCKET_TIMEOUT
) {
	if (!socket) {
		throw new Error('Live updates connection is not available yet.');
	}
	if (socket.readyState === WebSocket.OPEN) {
		return socket;
	}
	if (socket.readyState === WebSocket.CONNECTING) {
		await waitForUploadsSocketOpen(socket, timeoutMs);
		if (socket.readyState === WebSocket.OPEN) {
			return socket;
		}
	}
	throw new Error('Live updates connection lost. Please wait for the dashboard to reconnect.');
}

export async function sendUploadCommand(
	socket: WebSocket | null,
	command: UploadSocketCommand,
	options?: { timeoutMs?: number }
) {
	const readySocket = await ensureUploadsSocketReady(
		socket,
		options?.timeoutMs ?? DEFAULT_UPLOAD_SOCKET_TIMEOUT
	);
	readySocket.send(JSON.stringify(command));
}
