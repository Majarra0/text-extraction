<script>
	import { Image as ImageIcon, Moon, Sun } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { BRAND_NAME } from '$lib/brand';
	import { applyTheme, getPreferredTheme, getStoredTheme, toggleTheme as flipTheme } from '$lib/theme';
	// Page-specific title still supported but brand always YOCR
	let { title = BRAND_NAME } = $props();
	let loginStatus = $state(false);
	let isHomeRoute = $state(true);
	let theme = $state('light');

	function toggleTheme() {
		theme = flipTheme(theme);
	}

	onMount(() => {
		isHomeRoute = window.location.pathname === '/';
		loginStatus = !!localStorage.getItem('access');
		const stored = getStoredTheme();
		const initial = stored ?? getPreferredTheme();
		theme = initial;
		applyTheme(initial);
	});
</script>

<header
	class="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60"
>
	<div class="flex items-center gap-3 font-bold">
		<a
			href="/"
			class="flex items-center gap-3 rounded-lg bg-transparent text-left transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
			aria-label={BRAND_NAME}
		>
			<ImageIcon class="h-6 w-6 text-[var(--primary)]" />
			<span class="sr-only">{BRAND_NAME}</span>
		</a>
	</div>

	<!-- Optional: Add a slot here if you want to pass buttons (like logout) to the right side -->
	<div class="flex items-center gap-4">
		<slot />
		<div class="flex items-center gap-4">
			<Button
				variant="ghost"
				size="icon"
				class="cursor-pointer"
				onclick={toggleTheme}
				aria-label="Toggle color mode"
			>
				{#if theme === 'dark'}
					<Sun class="h-4 w-4" />
				{:else}
					<Moon class="h-4 w-4" />
				{/if}
			</Button>
			{#if isHomeRoute && loginStatus}
				<div
					class="px-4 bg-transparent text-[var(--primary)] cursor-pointer"
					onclick={() => {
						window.location.href = '/dashboard';
					}}
				>
					dashboard
				</div>
			{/if}
			{#if loginStatus}
				<div
					class="text-sm text-red-600 hover:underline"
					onclick={() => {
						localStorage.removeItem('access');
						localStorage.removeItem('refresh');
						localStorage.removeItem('user');
						window.location.href = '/';
					}}
				>
					Logout
				</div>
			{/if}
			{#if !loginStatus}
				<Button
					class="cursor-pointer"
					disabled={false}
					onclick={() => {
						window.location.href = '/login';
					}}>login</Button
				>
				<Button
					class="bg-transparent border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 cursor-pointer"
					disabled={false}
					onclick={() => {
						window.location.href = '/signup';
					}}>Siginup</Button
				>
			{/if}
		</div>
	</div>
</header>
