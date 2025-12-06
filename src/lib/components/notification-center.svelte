<script lang="ts">
	import { fly } from 'svelte/transition';
	import { notifications, dismissNotification, type Notification } from '$lib/stores/notifications';
	import { onDestroy } from 'svelte';

	let items = $state<Notification[]>([]);
	const unsubscribe = notifications.subscribe((value) => {
		items = value;
	});

	onDestroy(() => {
		unsubscribe();
	});

	function classesForIntent(intent: Notification['intent']) {
		return intent === 'success'
			? 'border-emerald-500/60 bg-emerald-950/90 text-emerald-100'
			: 'border-red-500/60 bg-red-950/85 text-red-100';
	}
</script>

{#if items.length > 0}
	<div class="fixed inset-x-0 top-4 z-[1000] flex justify-center px-4 pointer-events-none sm:justify-end sm:px-6">
		<div class="flex w-full max-w-sm flex-col gap-3">
			{#each items as notification (notification.id)}
				<div
					in:fly={{ y: -12, opacity: 0, duration: 180 }}
					out:fly={{ y: 12, opacity: 0, duration: 180 }}
					class={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${classesForIntent(notification.intent)}`}
				>
					<div class="flex items-start gap-3">
						<div class="flex-1 text-sm leading-tight">{notification.message}</div>
						<button
							type="button"
							class="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
							onclick={() => dismissNotification(notification.id)}
						>
							Close
						</button>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
