<script>
	import { Image as ImageIcon } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	// Allow the title to be passed in, defaulting to "Dashboard"
	let { title = 'Dashboard' } = $props();
	let loginStatus = $state(false);
	let isHome = $state(false);
	onMount(() => {
		isHome = window.location.pathname !== '/';
		console.log('Header mounted');
		loginStatus = !!localStorage.getItem('access');
		console.log(loginStatus);
	});
</script>

<header
	class="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60"
>
	<div class="flex items-center gap-2 font-bold">
		<ImageIcon class="h-5 w-5" />
		<h1 class="text-lg tracking-tight">{title}</h1>
		{#if isHome}
			<div
				class="px-4 bg-transparent text-[var(--primary)] cursor-pointer"
				onclick={() => {
					window.location.href = '/';
				}}
			>
				home
			</div>
		{/if}
	</div>

	<!-- Optional: Add a slot here if you want to pass buttons (like logout) to the right side -->
	<div class="flex items-center gap-4">
		<slot />
		<div class="flex items-center gap-4">
			{#if !isHome && loginStatus}
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
