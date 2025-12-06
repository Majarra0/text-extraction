const THEME_STORAGE_KEY = 'theme';

export type ThemeMode = 'light' | 'dark';

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

export function getStoredTheme(): ThemeMode | null {
	if (!isBrowser()) return null;
	const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
	return stored === 'dark' || stored === 'light' ? stored : null;
}

export function getPreferredTheme(): ThemeMode {
	if (isBrowser() && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
		return 'dark';
	}
	return 'light';
}

export function applyTheme(theme: ThemeMode) {
	if (!isBrowser()) {
		return;
	}
	const root = document.documentElement;
	root.classList.toggle('dark', theme === 'dark');
	window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function initTheme() {
	const initial = getStoredTheme() ?? getPreferredTheme();
	applyTheme(initial);
	return initial;
}

export function toggleTheme(current?: ThemeMode) {
	const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
	applyTheme(next);
	return next;
}
