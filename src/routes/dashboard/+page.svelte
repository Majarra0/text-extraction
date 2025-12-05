<script lang="ts">
	import { Search, Trash2, Image as ImageIcon } from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
	import { on } from 'svelte/events';
	// 1. Mock Data representing photos with extracted text
	// In a real app, this would come from your API via `export let data;`
	let extractedDataItems = [
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
	];

	function handleRemove(id: string) {
		console.log(`Removing item with id: ${id}`);
		extractedDataItems = extractedDataItems.filter((item) => item.id !== id);
		console.log('Item removed. Current items:', extractedDataItems.length);
	}
</script>

<div class="flex min-h-screen flex-col bg-background">
	<header
		class="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60"
	>
		<div class="flex items-center gap-2 font-bold">
			<ImageIcon class="h-5 w-5" />
			<h1 class="text-lg tracking-tight">Dashboard</h1>
		</div>
	</header>

	<main class="flex-1 p-6">
		<!-- // search bar with functionality can be added later -->
		<div class="mb-4 flex items-center justify-between">
			<div class="relative w-full max-w-xs">
				<Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
				<Input type="search" placeholder="Search extracted text..." class="w-full pl-8" />
			</div>
		</div>
		<div class="rounded-md border">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-[100px]">Photo</Table.Head>
						<Table.Head>Extracted Text</Table.Head>
						<Table.Head class="text-right">Remove</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each extractedDataItems as item (item.id)}
						<Table.Row>
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
									class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
							<Table.Cell colspan={3} class="h-24 text-center">No results found.</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</div>
	</main>
</div>
