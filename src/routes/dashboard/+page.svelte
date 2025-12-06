<script>
	import { Search, Trash2, Image as ImageIcon } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
	import Header from '../components/header.svelte';
	import { API_ROUTES, toAbsoluteUrl, buildWebSocketUrl } from '$lib/config';

	/**
	 * @typedef {{
	 * 	id: string;
	 * 	auto_language_detection?: boolean;
	 * 	language_hint?: string | null;
	 * 	output_format?: 'raw' | 'paragraph';
	 * 	ocr_mode?: 'fast' | 'high_accuracy';
	 * 	image_url?: string | null;
	 * 	raw_text?: string | null;
	 * 	processed_text?: string | null;
	 * }} UploadResponse
	 *
	 * @typedef {{
	 * 	id: string;
	 * 	autoLanguageDetection: boolean;
	 * 	languageHint: string | null;
	 * 	outputFormat: 'raw' | 'paragraph';
	 * 	ocrMode: 'fast' | 'high_accuracy';
	 * 	imageUrl: string;
	 * 	extractedText: string;
	 * }} UploadRow
	 */

	/**
	 * @param {UploadResponse} upload
	 * @returns {UploadRow}
	 */
	function mapUploadToRow(upload) {
		return {
			id: upload.id,
			autoLanguageDetection: upload.auto_language_detection ?? true,
			languageHint: upload.language_hint ?? null,
			outputFormat: normalizeOutputFormat(upload.output_format),
			ocrMode: normalizeOcrMode(upload.ocr_mode),
			imageUrl: toAbsoluteUrl(upload.image_url),
			extractedText:
				upload.processed_text || upload.raw_text || 'No extracted text is available yet.'
		};
	}

	function normalizeOutputFormat(value) {
		return value === 'paragraph' ? 'paragraph' : 'raw';
	}

	function normalizeOcrMode(value) {
		return value === 'high_accuracy' ? 'high_accuracy' : 'fast';
	}

	/** @type {UploadRow[]} */
	let extractedDataItems = $state([]);
	/** @type {Set<string>} */
	let selectedIds = $state(new Set());
	let searchQuery = $state('');
	let isLoading = $state(true);
	let fetchError = $state('');
	/** @type {Map<string, string>} */
	let imagePreviewUrls = $state(new Map());
	let lastSuccessfulAccessToken = null;
	const websocketConnections = new Map();
	const websocketRetryTimers = new Map();
	let dashboardDestroyed = false;
	const WEBSOCKET_RECONNECT_DELAY = 4000;

	onMount(() => {
		void initializeDashboard();
	});
	onDestroy(() => {
		dashboardDestroyed = true;
		clearImagePreviews();
		cleanupWebsockets();
	});

	async function initializeDashboard() {
		const token = await ensureAccessToken();
		if (!token) {
			isLoading = false;
			redirectToLogin();
			return;
		}
		await loadUploads(token);
	}

	async function ensureAccessToken() {
		const access = localStorage.getItem('access');
		if (access) return access;
		return await refreshAccessToken();
	}

	async function refreshAccessToken() {
		const refresh = localStorage.getItem('refresh');
		if (!refresh) return null;

		try {
			const response = await fetch(API_ROUTES.auth.refresh, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refresh })
			});

			if (!response.ok) {
				return null;
			}

			const data = await response.json();
			if (data.access) {
				localStorage.setItem('access', data.access);
				return data.access;
			}
		} catch (error) {
			console.error('Failed to refresh access token:', error);
		}

		return null;
	}

	async function loadUploads(token) {
		isLoading = true;
		fetchError = '';

		try {
			let authToken = token;
			let response = await fetchUploads(authToken);

			if (response?.status === 401) {
				const refreshed = await refreshAccessToken();
				if (!refreshed) {
					redirectToLogin();
					return;
				}

				authToken = refreshed;
				response = await fetchUploads(authToken);
			}

			if (!response || !response.ok) {
				throw new Error('Failed to load uploads. Please try again.');
			}

			const uploads = /** @type {UploadResponse[]} */ (await response.json());

			extractedDataItems = uploads.map(mapUploadToRow);
			lastSuccessfulAccessToken = authToken;
			await preloadImagePreviews(extractedDataItems, authToken);
			selectedIds = new Set();
			syncWebsocketSubscriptions(extractedDataItems);
		} catch (error) {
			console.error('Failed to fetch uploads:', error);
			const message = error instanceof Error ? error.message : 'Unable to load uploads.';
			fetchError = message;
		} finally {
			isLoading = false;
		}
	}

	function fetchUploads(token) {
		return fetch(API_ROUTES.core.uploads, {
			headers: {
				Authorization: `Bearer ${token}`
			}
		});
	}

	function syncWebsocketSubscriptions(items) {
		const ids = new Set(items.map((item) => item.id));
		for (const id of websocketConnections.keys()) {
			if (!ids.has(id)) {
				unsubscribeFromUpload(id);
			}
		}
		for (const id of ids) {
			subscribeToUpload(id);
		}
	}

	function subscribeToUpload(id) {
		if (dashboardDestroyed || websocketConnections.has(id)) return;
		const wsUrl = buildWebSocketUrl(`/ws/core/Upload/${id}/`);
		try {
			const socket = new WebSocket(wsUrl);
			websocketConnections.set(id, socket);
			socket.onopen = () => {
				try {
					socket.send(JSON.stringify({ type: 'subscribe' }));
				} catch (error) {
					console.warn('Failed to send subscribe message', error);
				}
			};
			socket.onmessage = (event) => handleSocketMessage(id, event);
			socket.onerror = () => {
				socket.close();
			};
			socket.onclose = () => handleSocketClose(id);
		} catch (error) {
			console.error(`Failed to connect to websocket for upload ${id}`, error);
		}
	}

	function handleSocketClose(id) {
		websocketConnections.delete(id);
		if (dashboardDestroyed) return;
		if (websocketRetryTimers.has(id)) return;
		const timer = setTimeout(() => {
			websocketRetryTimers.delete(id);
			subscribeToUpload(id);
		}, WEBSOCKET_RECONNECT_DELAY);
		websocketRetryTimers.set(id, timer);
	}

	function unsubscribeFromUpload(id) {
		const socket = websocketConnections.get(id);
		if (socket) {
			socket.onclose = null;
			socket.close();
			websocketConnections.delete(id);
		}
		const timer = websocketRetryTimers.get(id);
		if (timer) {
			clearTimeout(timer);
			websocketRetryTimers.delete(id);
		}
	}

	function cleanupWebsockets() {
		for (const id of websocketConnections.keys()) {
			unsubscribeFromUpload(id);
		}
	}

	function handleSocketMessage(id, event) {
		let payload;
		try {
			payload = JSON.parse(event.data);
		} catch (error) {
			console.error('Failed to parse websocket payload', error);
			return;
		}
		if (!payload || payload.type !== 'Upload.status') {
			return;
		}
		if (!payload.instance) {
			removeUploadRow(id);
			unsubscribeFromUpload(id);
			return;
		}
		const mapped = mapUploadToRow(payload.instance);
		upsertUploadRow(mapped);
	}

	async function preloadImagePreviews(items, token) {
		clearImagePreviews();
		const entries = await Promise.all(
			items.map(async (item) => {
				if (!item.imageUrl) return null;
				try {
					const response = await fetch(item.imageUrl, {
						headers: { Authorization: `Bearer ${token}` }
					});
					if (!response.ok) {
						return null;
					}
					const blob = await response.blob();
					const objectUrl = URL.createObjectURL(blob);
					return /** @type {[string, string]} */ ([item.id, objectUrl]);
				} catch (error) {
					console.error(`Failed to load preview for upload ${item.id}`, error);
					return null;
				}
			})
		);

		const next = new Map();
		for (const entry of entries) {
			if (entry) {
				next.set(entry[0], entry[1]);
			}
		}
		imagePreviewUrls = next;
	}

	function clearImagePreviews() {
		for (const url of imagePreviewUrls.values()) {
			URL.revokeObjectURL(url);
		}
		imagePreviewUrls = new Map();
	}

	function redirectToLogin() {
		localStorage.removeItem('access');
		localStorage.removeItem('refresh');
		localStorage.removeItem('user');
		window.location.href = '/login';
	}

	function hasDisplayableImage(url) {
		return typeof url === 'string' && /^(https?:|data:|blob:)/.test(url);
	}

	let filteredItems = $derived(
		extractedDataItems.filter((item) =>
			item.extractedText.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	function handleRemove(id) {
		extractedDataItems = extractedDataItems.filter((item) => item.id !== id);
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
		selectedIds = next;
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

	function indeterminate(node, active) {
		node.indeterminate = active;
		return {
			update(newActive) {
				node.indeterminate = newActive;
			}
		};
	}

	function upsertUploadRow(row) {
		const index = extractedDataItems.findIndex((item) => item.id === row.id);
		if (index === -1) {
			extractedDataItems = [row, ...extractedDataItems];
		} else {
			const next = [...extractedDataItems];
			next[index] = { ...next[index], ...row };
			extractedDataItems = next;
		}
		if (lastSuccessfulAccessToken) {
			void fetchAndStorePreview(row, lastSuccessfulAccessToken);
		}
	}

	function removeUploadRow(id) {
		const next = extractedDataItems.filter((item) => item.id !== id);
		if (next.length === extractedDataItems.length) return;
		extractedDataItems = next;
		const previews = new Map(imagePreviewUrls);
		const existing = previews.get(id);
		if (existing) {
			URL.revokeObjectURL(existing);
			previews.delete(id);
			imagePreviewUrls = previews;
		}
		if (selectedIds.has(id)) {
			const nextSelected = new Set(selectedIds);
			nextSelected.delete(id);
			selectedIds = nextSelected;
		}
	}

	async function fetchAndStorePreview(row, token) {
		if (!row.imageUrl || !token) return;
		try {
			const response = await fetch(row.imageUrl, {
				headers: {
					Authorization: `Bearer ${token}`
				}
			});
			if (!response.ok) {
				return;
			}
			const blob = await response.blob();
			const objectUrl = URL.createObjectURL(blob);
			const next = new Map(imagePreviewUrls);
			const previous = next.get(row.id);
			if (previous) {
				URL.revokeObjectURL(previous);
			}
			next.set(row.id, objectUrl);
			imagePreviewUrls = next;
		} catch (error) {
			console.error(`Failed to update preview for upload ${row.id}`, error);
		}
	}
</script>


<div class="flex min-h-screen flex-col bg-background">
	<Header title="Dashboard"></Header>
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
						<Table.Head class="w-[180px] text-right">OCR Settings</Table.Head>
						<Table.Head class="text-right">Remove</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if isLoading}
						<Table.Row>
							<Table.Cell colspan={5} class="h-24 text-center text-sm text-muted-foreground">
								Loading uploads...
							</Table.Cell>
						</Table.Row>
					{:else if fetchError}
						<Table.Row>
							<Table.Cell colspan={5} class="h-24 text-center text-sm text-destructive">
								{fetchError}
							</Table.Cell>
						</Table.Row>
					{:else}
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
									{#if imagePreviewUrls.get(item.id)}
										<img
											src={imagePreviewUrls.get(item.id)}
											alt="Source"
											class="aspect-square h-16 w-16 rounded-md object-cover border"
										/>
									{:else if hasDisplayableImage(item.imageUrl)}
										<img
											src={item.imageUrl}
											alt="Source"
											class="aspect-square h-16 w-16 rounded-md object-cover border"
										/>
									{:else}
										<div
											class="flex aspect-square h-16 w-16 items-center justify-center rounded-md border bg-muted text-muted-foreground"
										>
											<ImageIcon class="h-5 w-5" />
										</div>
									{/if}
								</Table.Cell>

								<Table.Cell class="font-medium">
									<p class="line-clamp-3 text-sm">
										{item.extractedText}
									</p>
								</Table.Cell>

								<Table.Cell class="text-right align-top">
									<div class="flex flex-col items-end gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
										<span class="rounded-full border px-2 py-0.5 text-xs">
											{item.ocrMode === 'high_accuracy' ? 'High accuracy' : 'Fast'}
										</span>
										<span class="rounded-full border px-2 py-0.5 text-xs">
											{item.outputFormat === 'paragraph' ? 'Paragraphs' : 'Raw text'}
										</span>
										<span class="rounded-full border px-2 py-0.5 text-xs">
											{item.autoLanguageDetection ? 'Auto language' : item.languageHint
												? `Lang: ${item.languageHint}`
												: 'Manual language'}
										</span>
									</div>
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
						{#if filteredItems.length === 0}
							<Table.Row>
								<Table.Cell colspan={5} class="h-24 text-center text-sm text-muted-foreground">
									No uploads match your search.
								</Table.Cell>
							</Table.Row>
						{/if}
					{/if}
				</Table.Body>
			</Table.Root>
		</div>
	</main>
</div>
