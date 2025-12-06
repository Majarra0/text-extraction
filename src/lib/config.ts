const DEFAULT_BACKEND_URL = 'http://localhost:3000';
const DEFAULT_API_VERSION = 'v1';

/**
 * Normalizes URLs by removing any trailing slash so we avoid accidental
 * double slashes when composing endpoints.
 */
function normalizeBaseUrl(url: string) {
	return url.replace(/\/+$/, '');
}

/**
 * Normalizes path segments by trimming slashes on both ends.
 */
function normalizeSegment(segment: string) {
	return segment.replace(/^\/+|\/+$/g, '');
}

const rawBackendUrl =
	(import.meta.env.VITE_BACKEND_URL as string | undefined) ??
	(import.meta.env.VITE_API_BASE_URL as string | undefined) ??
	DEFAULT_BACKEND_URL;

export const BACKEND_URL = normalizeBaseUrl(rawBackendUrl);
export const API_VERSION = normalizeSegment(
	(import.meta.env.VITE_API_VERSION as string | undefined) ?? DEFAULT_API_VERSION
);
export const API_BASE_URL = `${BACKEND_URL}/api/${API_VERSION}`;
export const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT ?? 30000);
const backendUrlObject = new URL(BACKEND_URL);

/**
 * Builds an absolute URL for resources exposed as relative API paths.
 */
export function toAbsoluteUrl(path?: string | null) {
	if (!path) return '';
	if (/^https?:\/\//i.test(path)) return path;
	return `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const ENV = {
	BACKEND_URL,
	API_VERSION,
	API_BASE_URL,
	API_TIMEOUT
} as const;

export const API_ROUTES = {
	auth: {
		login: `${API_BASE_URL}/users/login/`,
		signup: `${API_BASE_URL}/users/signup/`,
		refresh: `${API_BASE_URL}/users/refresh/`,
		refreshToken: `${API_BASE_URL}/users/refresh/token/`,
		logout: `${API_BASE_URL}/users/logout/`
	},
	core: {
		uploads: `${API_BASE_URL}/core/uploads/`
	}
} as const;

function normalizeWebSocketPath(path: string) {
	const cleaned = path.startsWith('/') ? path : `/${path}`;
	const basePath = backendUrlObject.pathname.replace(/\/$/, '');
	return `${basePath}${cleaned}`.replace(/\/{2,}/g, '/');
}

export function buildWebSocketUrl(path = '/') {
	const normalizedPath = normalizeWebSocketPath(path);
	const protocol = backendUrlObject.protocol === 'https:' ? 'wss:' : 'ws:';
	return `${protocol}//${backendUrlObject.host}${normalizedPath}`;
}
