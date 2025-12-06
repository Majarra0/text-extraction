<script>
	import { Search, Trash2, Image as ImageIcon } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
	import Header from '../components/header.svelte';
	import { API_ROUTES, toAbsoluteUrl } from '$lib/config';
	import {
		UploadSocketCommands,
		createUploadsWebSocket,
		sendUploadCommand
	} from '$lib/api/uploadsSocket';
	import { notifySuccess } from '$lib/stores/notifications';

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
 *
 * @typedef {{
 * 	id?: string;
 * 	email?: string;
 * 	username?: string;
 * 	role?: string;
 * 	last_ip?: string | null;
 * 	name?: string;
	 * }} StoredUser
	 */

	/**
	 * @typedef {{
	 * 	type?: string;
	 * 	list?: UploadResponse[];
	 * 	instance?: UploadResponse | null;
	 * 	instance_id?: string | null;
	 * 	id?: string;
	 * 	status?: string;
	 * 	streamed_text?: string | null;
	 * 	processed_text?: string | null;
	 * 	raw_text?: string | null;
	 * 	image_url?: string | null;
	 * }} UploadSocketMessage
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
	let deleteError = $state('');
	/** @type {Map<string, string>} */
	let imagePreviewUrls = $state(new Map());
	/** @type {StoredUser | null} */
	let accountInfo = $state(null);
	let lastSuccessfulAccessToken = null;
	let uploadsSocket = null;
	let uploadsSocketReconnectTimer = null;
	let dashboardDestroyed = false;
	const WEBSOCKET_RECONNECT_DELAY = 4000;

	onMount(() => {
		loadAccountInfo();
		void initializeDashboard();
	});
	onDestroy(() => {
		dashboardDestroyed = true;
		clearImagePreviews();
		teardownUploadsSocket();
	});

	async function initializeDashboard() {
		isLoading = true;
		fetchError = '';
		const token = await ensureAccessToken();
		if (!token) {
			isLoading = false;
			redirectToLogin();
			return;
		}
		lastSuccessfulAccessToken = token;
		connectUploadsSocket(token);
	}

	function loadAccountInfo() {
		try {
			const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
			accountInfo = stored ? JSON.parse(stored) : null;
		} catch (error) {
			console.warn('Failed to parse stored user payload', error);
			accountInfo = null;
		}
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

	function connectUploadsSocket(token) {
		teardownUploadsSocket();
		try {
			uploadsSocket = createUploadsWebSocket(token);
		} catch (error) {
			console.error('Failed to initialize uploads websocket', error);
			scheduleUploadsReconnect();
			return;
		}
		uploadsSocket.onopen = () => {
			const sendInitialCommands = async () => {
				try {
					await sendUploadCommand(uploadsSocket, UploadSocketCommands.subscribe());
					await sendUploadCommand(uploadsSocket, UploadSocketCommands.list());
				} catch (error) {
					console.error('Failed to request uploads list', error);
				}
			};
			void sendInitialCommands();
		};
		uploadsSocket.onmessage = (event) => {
			void handleUploadsSocketMessage(event, token);
		};
		uploadsSocket.onerror = () => {
			uploadsSocket?.close();
		};
		uploadsSocket.onclose = () => {
			if (dashboardDestroyed) return;
			scheduleUploadsReconnect();
		};
	}

	function scheduleUploadsReconnect() {
		if (uploadsSocketReconnectTimer || dashboardDestroyed) return;
		uploadsSocketReconnectTimer = setTimeout(async () => {
			uploadsSocketReconnectTimer = null;
			const refreshed = await ensureAccessToken();
			if (!refreshed) {
				redirectToLogin();
				return;
			}
			lastSuccessfulAccessToken = refreshed;
			connectUploadsSocket(refreshed);
		}, WEBSOCKET_RECONNECT_DELAY);
	}

	function teardownUploadsSocket() {
		if (uploadsSocketReconnectTimer) {
			clearTimeout(uploadsSocketReconnectTimer);
			uploadsSocketReconnectTimer = null;
		}
		if (uploadsSocket) {
			uploadsSocket.onopen = uploadsSocket.onclose = uploadsSocket.onmessage = uploadsSocket.onerror = null;
			uploadsSocket.close();
			uploadsSocket = null;
		}
	}

	async function handleUploadsSocketMessage(event, token) {
		let payload;
		try {
			payload = JSON.parse(event.data);
		} catch (error) {
			console.error('Failed to parse uploads websocket payload', error);
			return;
		}
		if (!payload?.type) {
			return;
		}

		if (payload.type === 'Upload.list') {
			const uploads = Array.isArray(payload.list) ? payload.list : [];
			extractedDataItems = uploads.map(mapUploadToRow);
			lastSuccessfulAccessToken = token;
			await preloadImagePreviews(extractedDataItems, token);
			selectedIds = new Set();
			isLoading = false;
			fetchError = '';
			return;
		}

		if (payload.type === 'Upload.created' || payload.type === 'Upload.updated' || payload.type === 'Upload.status') {
			const upload = extractUploadFromSocket(payload);
			if (!upload) return;
			supsertUploadRow(mapUploadToRow(upload));
			return;
		}

		if (payload.type === 'Upload.deleted') {
			const targetId = payload.instance?.id ?? payload.instance_id ?? payload.id;
			if (targetId) {
				removeUploadRow(targetId);
			}
		}
	}

	function extractUploadFromSocket(payload) {
		if (payload.instance) {
			return payload.instance;
		}
		if (!payload.id) {
			return null;
		}
		return {
			id: payload.id,
			image_url: payload.image_url,
			processed_text: payload.processed_text,
			raw_text: payload.raw_text ?? payload.streamed_text,
			streamed_text: payload.streamed_text,
			status: payload.status
		};
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

	async function handleRemove(id) {
		deleteError = '';
		try {
			await deleteUploadInstance(id);
			removeUploadRow(id);
			notifySuccess('Upload deleted successfully.');
		} catch (error) {
			console.error('Failed to delete upload', error);
			deleteError = error instanceof Error ? error.message : 'Failed to delete upload.';
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

	async function removeSelected() {
		if (selectedIds.size === 0) return;
		deleteError = '';
		const ids = Array.from(selectedIds);
		const failures = [];
		let successCount = 0;
		for (const id of ids) {
			try {
				await deleteUploadInstance(id);
				removeUploadRow(id);
				successCount += 1;
			} catch (error) {
				console.error(`Failed to delete upload ${id}`, error);
				failures.push(error instanceof Error ? error.message : 'Failed to delete upload.');
			}
		}
		if (failures.length > 0) {
			deleteError = failures[0];
		}
		if (successCount > 0) {
			const label = successCount === 1 ? 'upload' : 'uploads';
			notifySuccess(`Deleted ${successCount} ${label}.`);
		}
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

	async function deleteUploadInstance(id) {
		try {
			await sendUploadCommand(uploadsSocket, UploadSocketCommands.delete(id));
		} catch (error) {
			console.error('Failed to send delete command via websocket', error);
			const message =
				error instanceof Error
					? error.message
					: 'Unable to send delete command. Please try again once the connection is stable.';
			throw new Error(message);
		}
	}
</script>


<div class="flex min-h-screen flex-col bg-background">
	<Header title={accountInfo?.name ?? 'Dashboard'}></Header>
	<main class="flex-1 p-6 w-full max-w-5xl mx-auto">
		{#if accountInfo?.email}
			<section
				class="mb-6 rounded-3xl border border-[var(--border)] bg-[var(--card)]/80 p-6 text-sm shadow-sm"
			>
				<p class="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Account email</p>
				<p class="mt-1 text-lg font-semibold text-[var(--foreground)]">
					{accountInfo.email}
				</p>
			</section>
		{/if}

		{#if deleteError}
			<div class="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
				{deleteError}
			</div>
		{/if}

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
											loading="lazy"
											alt="Source"
											class="aspect-square h-16 w-16 rounded-md object-cover border"
										/>
									{:else if hasDisplayableImage(item.imageUrl)}
										<img
											src={item.imageUrl}
											loading="lazy"
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
