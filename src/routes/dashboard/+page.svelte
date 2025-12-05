<script>
	import { Search, Trash2, Image as ImageIcon } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
	import Header from '../components/header.svelte';
	// Svelte 5 State
	let extractedDataItems = $state([
		{
			id: '1',
			imageUrl: 'https://picsum.photos/id/237/200/200',
			extractedText: 'Receipt ID: 123456. Total: $45.99. Date: 2023-10-27.'
		},
		{
			id: '2',
			imageUrl: 'https://picsum.photos/id/1/200/200',
			extractedText:
				'Warning: Unauthorized access prohibited. Security cameras in use. Please keep clear of the area.'
		},
		{
			id: '3',
			imageUrl: 'https://picsum.photos/id/10/200/200',
			extractedText:
				'Notes from meeting: Discussed Q4 goals, marketing strategy, and budget allocation.'
		},
		{
			id: '4',
			imageUrl: 'https://picsum.photos/id/20/200/200',
			extractedText: 'Invoice #99281. Billed to Acme Corp. Due date: Immediate.'
		},
		{
			id: '5',
			imageUrl: 'https://picsum.photos/id/30/200/200',
			extractedText: 'Menu item number 4: Grilled Salmon with asparagus.'
		}
	]);
	onMount(() => {
		// Any layout-level onMount logic can go here
		const access = localStorage.getItem('access'); // Example usage
		const refresh = localStorage.getItem('refresh');
		if (!access && !refresh) {
			window.location.href = '/login';
		}
		// If access token missing but refresh token exists, try to refresh
		if (!access && refresh) {
			try {
				const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
				fetch(`${apiUrl}/api/v1/users/refresh/token/`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${refresh}`
					}
				})
					.then((res) => res.json())
					.then((data) => {
						if (data.access_token) {
							localStorage.setItem('access', data.access_token);
							window.location.href = '/dashboard';
						} else {
							console.log('No access token in refresh response');
							// window.location.href = '/login';
						}
					})
					.catch((err) => {
						console.error('Token refresh failed:', err);
						localStorage.removeItem('access');
						localStorage.removeItem('refresh');
						calStorage.removeItem('user');
						// window.location.href = '/login';
					});
			} catch (err) {
				console.log('Error during token refresh:', err);
				window.location.href = '/login';
			}
		}
	});

	let selectedIds = $state(new Set());
	let searchQuery = $state('');

	// Filter items based on search query
	let filteredItems = $derived(
		extractedDataItems.filter((item) =>
			item.extractedText.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);
	function handleRemove(id) {
		extractedDataItems = extractedDataItems.filter((item) => item.id !== id);
		// Also remove from selection if it was selected
		if (selectedIds.has(id)) {
			const next = new Set(selectedIds);
			next.delete(id);
			selectedIds = next;
		}
	}

	function toggleSelection(id) {
		const next = new Set(selectedIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		selectedIds = next; // Reassign to trigger reactivity
	}

	function selectAll() {
		if (selectedIds.size === filteredItems.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(filteredItems.map((item) => item.id));
		}
	}

	function removeSelected() {
		extractedDataItems = extractedDataItems.filter((item) => !selectedIds.has(item.id));
		selectedIds = new Set();
	}

	// Helper for indeterminate state
	function indeterminate(node, active) {
		node.indeterminate = active;
		return {
			update(newActive) {
				node.indeterminate = newActive;
			}
		};
	}

	onMount(() => {
		const accessToken = localStorage.getItem('access');
		const refreshToken = localStorage.getItem('refresh');

		// Simple auth check mock
		if (!accessToken && !refreshToken) {
			console.log('Redirect to login in real app');
		}
		if (!accessToken || refreshToken) {
			console.log('Redirect to login in real app');
		}
	});
</script>

<div class="flex min-h-screen flex-col bg-background">
	<Header title="Dashboard"></Header>/
	<main class="flex-1 p-6 max-w-5xl mx-auto">
		<!-- Search bar and bulk actions -->
		<div class="mb-4 flex items-center justify-between">
			<div class="relative w-full max-w-xs">
				<Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
				<Input
					type="search"
					placeholder="Search extracted text..."
					class="w-full pl-8"
					bind:value={searchQuery}
				/>
			</div>

			{#if selectedIds.size > 0}
				<div class="flex items-center gap-4">
					<span class="text-sm text-muted-foreground">{selectedIds.size} selected</span>
					<Button
						variant="destructive"
						onclick={removeSelected}
						class="bg-destructive hover:bg-destructive/90 text-white"
					>
						Delete Selected
					</Button>
				</div>
			{/if}
		</div>

		<div class="rounded-md">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-[50px]">
							<input
								type="checkbox"
								checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
								use:indeterminate={selectedIds.size > 0 && selectedIds.size < filteredItems.length}
								onchange={selectAll}
								class="cursor-pointer"
							/>
						</Table.Head>
						<Table.Head class="w-[100px]">Photo</Table.Head>
						<Table.Head>Extracted Text</Table.Head>
						<Table.Head class="text-right">Remove</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each filteredItems as item (item.id)}
						<Table.Row>
							<Table.Cell>
								<input
									type="checkbox"
									checked={selectedIds.has(item.id)}
									onchange={() => toggleSelection(item.id)}
									class="cursor-pointer"
								/>
							</Table.Cell>
							<Table.Cell>
								<img
									src={item.imageUrl}
									alt="Source"
									class="aspect-square h-16 w-16 rounded-md object-cover border"
								/>
							</Table.Cell>

							<Table.Cell class="font-medium">
								<p class="line-clamp-3 text-sm">
									{item.extractedText}
								</p>
							</Table.Cell>

							<Table.Cell class="text-right">
								<Button
									variant="ghost"
									size="icon"
									class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
									onclick={() => handleRemove(item.id)}
									aria-label="Remove item"
								>
									<Trash2 class="h-5 w-5" />
								</Button>
							</Table.Cell>
						</Table.Row>
					{/each}
					{#if extractedDataItems.length === 0}
						<Table.Row>
							<Table.Cell colspan={4} class="h-24 text-center">No results found.</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</div>
	</main>
</div>
