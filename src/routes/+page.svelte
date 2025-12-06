<script lang="ts">
	import { slide } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';
	import Header from './components/header.svelte';
	import { API_ROUTES, toAbsoluteUrl } from '$lib/config';
	import { BRAND_NAME, PRIMARY_TAGLINE } from '$lib/brand';

	type UploadResponse = {
		id: string;
		image_url?: string | null;
		raw_text?: string | null;
		processed_text?: string | null;
		auto_language_detection?: boolean;
		language_hint?: string | null;
		output_format?: 'raw' | 'paragraph';
		ocr_mode?: 'fast' | 'high_accuracy';
	};
	type UploadCard = UploadResponse & { previewObjectUrl?: string | null };

	type ErrorResponse = {
		message?: string;
		errors?: Record<string, string[] | string>;
	};

	let selectedFile: File | null = null;
	let previewUrl: string | null = null;
	let isDragOver = false;
	let dragDepth = 0;
	let resultText = '';
	let isLoggedIn = false;
	let uploading = false;
	let uploadError = '';
	let uploadResult: UploadCard | null = null;
	let recentUploads: UploadCard[] = [];
	let showAdvanced = false;
	let autoLanguageDetection = true;
	let languageHint = '';
	let outputFormat: 'raw' | 'paragraph' = 'raw';
	let ocrMode: 'fast' | 'high_accuracy' = 'fast';

	$: uploadedImageEndpoint = uploadResult?.image_url
		? toAbsoluteUrl(uploadResult.image_url)
		: '';

	onMount(() => {
		try {
			isLoggedIn = !!localStorage.getItem('access');
		} catch (err) {
			console.log(err);
			isLoggedIn = false;
		}
	});
	onDestroy(() => {
		revokePreview();
		recentUploads.forEach((item) => cleanupUploadPreview(item));
	});

	function revokePreview() {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
			previewUrl = null;
		}
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement | null;
		if (!target) return;
		setSelectedFile(target.files?.[0] ?? null);
		resultText = '';
		uploadError = '';
		uploadResult = null;
	}

	function setSelectedFile(file: File | null) {
		revokePreview();
		selectedFile = file;
		if (file) {
			previewUrl = URL.createObjectURL(file);
		}
	}

	function clearSelectedFile(options: { preserveFeedback?: boolean } = {}) {
		const { preserveFeedback = false } = options;
		setSelectedFile(null);
		if (!preserveFeedback) {
			resultText = '';
			uploadError = '';
			uploadResult = null;
		}
		const input = document.getElementById('image-upload') as HTMLInputElement | null;
		if (input) input.value = '';
	}

	async function analyzeImage() {
		if (!selectedFile) {
			uploadError = 'Please select an image first.';
			return;
		}

		const token = await ensureAccessToken();
		if (!token) {
			uploadError = 'Please log in to upload images.';
			return;
		}

		uploading = true;
		uploadError = '';
		resultText = '⏳ Uploading image...';
		uploadResult = null;

			try {
				let activeToken = token;
				let response = await uploadFile(activeToken, selectedFile);

			if (response.status === 401) {
					const refreshed = await refreshAccessToken();
					if (!refreshed) {
						throw new Error('Session expired. Please log in again.');
					}
					activeToken = refreshed;
					response = await uploadFile(activeToken, selectedFile);
				}

				if (!response.ok) {
				const message = await buildErrorMessage(response);
				throw new Error(message);
			}

			const upload = (await response.json()) as UploadResponse;
			const uploadWithPreview = await withPreview(upload, activeToken);
			const updatedHistory = [
				uploadWithPreview,
				...recentUploads.filter((item) => item.id !== uploadWithPreview.id)
			];
			recentUploads = updatedHistory;
			uploadResult = uploadWithPreview;
			resultText = createResultMessage(uploadWithPreview);
			clearSelectedFile({ preserveFeedback: true });
		} catch (error) {
			uploadError = error instanceof Error ? error.message : 'Failed to upload image.';
			resultText = '';
		} finally {
			uploading = false;
		}
	}

	function uploadFile(token: string, file: File) {
		const formData = new FormData();
		formData.append('image_file', file);
		formData.append('auto_language_detection', String(autoLanguageDetection));
		if (!autoLanguageDetection && languageHint.trim()) {
			formData.append('language_hint', languageHint.trim());
		}
		formData.append('output_format', outputFormat);
		formData.append('ocr_mode', ocrMode);
		return fetch(API_ROUTES.core.uploads, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`
			},
			body: formData
		});
	}

	async function ensureAccessToken(): Promise<string | null> {
		const access = localStorage.getItem('access');
		if (access) return access;
		return refreshAccessToken();
	}

	async function refreshAccessToken(): Promise<string | null> {
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

			const data = (await response.json()) as { access?: string };
			if (data.access) {
				localStorage.setItem('access', data.access);
				return data.access;
			}
		} catch (error) {
			console.error('Failed to refresh access token:', error);
		}

		return null;
	}

	async function buildErrorMessage(response: Response) {
		const fallback = `Failed to upload image (status ${response.status}).`;
		try {
			const data = (await response.json()) as ErrorResponse;
			if (data?.message) return data.message;
			if (data?.errors) {
				for (const value of Object.values(data.errors)) {
					if (!value) continue;
					if (Array.isArray(value) && value.length > 0) {
						return value[0];
					}
					if (typeof value === 'string') {
						return value;
					}
				}
			}
		} catch (err) {
			console.error('Failed to parse error response:', err);
		}
		return fallback;
	}

	function createResultMessage(upload: UploadResponse) {
		return (
			upload.processed_text ||
			upload.raw_text ||
			'Upload received. We are processing the text—check the dashboard in a moment.'
		);
	}

	function triggerFileDialog() {
		const input = document.getElementById('image-upload') as HTMLInputElement | null;
		input?.click();
	}

	function handleDropZoneKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			triggerFileDialog();
		}
	}

	function handleDragEnter(event: DragEvent) {
		event.preventDefault();
		dragDepth += 1;
		isDragOver = true;
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) {
			isDragOver = false;
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragDepth = 0;
		isDragOver = false;
		const file = event.dataTransfer?.files?.[0] ?? null;
		if (file) {
			setSelectedFile(file);
			resultText = '';
			uploadError = '';
			uploadResult = null;
		}
	}

	function removeRecentUpload(id: string) {
		const target = recentUploads.find((item) => item.id === id);
		cleanupUploadPreview(target);
		recentUploads = recentUploads.filter((item) => item.id !== id);
		if (uploadResult?.id === id) {
			uploadResult = recentUploads[0] ?? null;
		}
	}

	function formatOptionLabels(upload: UploadResponse) {
		const autoEnabled =
			upload.auto_language_detection === undefined ? true : upload.auto_language_detection;
		const labels = [
			upload.ocr_mode === 'high_accuracy' ? 'High accuracy' : 'Fast',
			upload.output_format === 'paragraph' ? 'Paragraphs' : 'Raw',
			autoEnabled
				? 'Auto language'
				: upload.language_hint
					? `Lang: ${upload.language_hint}`
					: 'Manual language'
		];
		return labels;
	}

	function cleanupUploadPreview(upload?: UploadCard) {
		if (upload?.previewObjectUrl) {
			URL.revokeObjectURL(upload.previewObjectUrl);
			upload.previewObjectUrl = null;
		}
	}

	async function withPreview(upload: UploadResponse, token?: string | null): Promise<UploadCard> {
		const previewObjectUrl = await fetchPreviewObjectUrl(upload.image_url, token);
		return { ...upload, previewObjectUrl };
	}

	async function fetchPreviewObjectUrl(
		imageUrl?: string | null,
		tokenOverride?: string | null
	): Promise<string | null> {
		if (!imageUrl) return null;
		const token = tokenOverride ?? (await ensureAccessToken());
		if (!token) {
			return null;
		}
		try {
			const response = await fetch(toAbsoluteUrl(imageUrl), {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!response.ok) {
				return null;
			}
			const blob = await response.blob();
			return URL.createObjectURL(blob);
		} catch (error) {
			console.error('Failed to fetch preview image', error);
			return null;
		}
	}

	async function ensurePreviewForUpload(upload: UploadCard) {
		if (upload.previewObjectUrl) return upload.previewObjectUrl;
		const preview = await fetchPreviewObjectUrl(upload.image_url);
		if (preview) {
			upload.previewObjectUrl = preview;
			recentUploads = [...recentUploads];
		}
		return preview;
	}

	async function previewUploadedImage(upload: UploadCard | null) {
		if (!upload) return;
		const preview = await ensurePreviewForUpload(upload);
		if (!preview) {
			uploadError = 'Unable to load image preview. Please try again.';
			return;
		}
		window.open(preview, '_blank', 'noopener,noreferrer');
	}
</script>

<Header title="OCR"></Header>

<main class="flex flex-col min-h-screen font-inter bg-gradient-soft transition-colors">
	<section class="flex-1 w-full px-6 py-12 text-[var(--foreground)]">
		<div class="mx-auto w-full max-w-5xl space-y-12">
			<div class="space-y-4 text-center">
				<h1 class="text-4xl lg:text-5xl font-semibold">
					<span class="text-[var(--primary)]">Yo</span>
					<span>, OCR your files!</span>
				</h1>
				<p class="text-base text-[var(--muted-foreground)] max-w-3xl mx-auto leading-relaxed">
					Drag a screenshot anywhere into the workspace or tap the canvas to pick a file. PNG, JPG, and HEIC are all welcome.
				</p>
				<p class="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Lossless previews • Realtime uploads</p>
			</div>
			<div class="space-y-8 max-w-4xl mx-auto w-full">
				<div
					class="drop-zone rounded-3xl border border-dashed border-[var(--border)]/80 px-10 py-16 min-h-[320px] text-center transition-all duration-300 bg-[var(--card)]/60 backdrop-blur flex flex-col items-center justify-center gap-2"
					class:drop-zone--active={isDragOver}
					role="button"
					tabindex="0"
					aria-label="Select or drop an image file"
					on:click={triggerFileDialog}
					on:keydown={handleDropZoneKeydown}
					on:dragenter|preventDefault={handleDragEnter}
					on:dragover|preventDefault={handleDragOver}
					on:dragleave|preventDefault={handleDragLeave}
					on:drop|preventDefault={handleDrop}
				>
					<p class="text-2xl font-semibold mb-2">Drag & drop your image</p>
					<p class="text-base text-[var(--muted-foreground)]">...or click to choose a file</p>
					{#if selectedFile}
						<p class="mt-6 text-sm font-medium">Ready: {selectedFile.name}</p>
					{/if}
					{#if !selectedFile && !previewUrl}
						<p class="mt-6 text-xs text-[var(--muted-foreground)]">
							Need inspiration? Drop a document straight from your desktop.
						</p>
					{/if}
				</div>

				<input
					id="image-upload"
					type="file"
					accept="image/*"
					class="hidden"
					on:change={handleFileChange}
				/>

				{#if previewUrl && selectedFile}
					<div class="flex items-start gap-4 rounded-2xl border border-dashed border-[var(--border)]/70 p-4 bg-[var(--card)]/80">
						<img
							src={previewUrl}
							alt="Selected preview"
							class="h-24 w-24 rounded-xl object-cover border"
						/>
						<div class="flex-1 space-y-2">
							<p class="text-sm font-medium text-[var(--foreground)]">{selectedFile.name}</p>
							<p class="text-xs text-[var(--muted-foreground)]">Ready to upload</p>
							<button
								type="button"
								class="text-sm text-red-500 hover:underline"
								on:click={clearSelectedFile}
							>
								Remove selected file
							</button>
						</div>
					</div>
				{/if}

				<div class="rounded-3xl border border-[var(--border)]/70 bg-[var(--card)]/70 shadow-sm">
					<button
						type="button"
						class="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
						aria-expanded={showAdvanced}
						aria-controls="advanced-ocr-options"
						on:click={() => (showAdvanced = !showAdvanced)}
					>
						<span>Advanced OCR options</span>
						<span class="text-xs text-[var(--muted-foreground)]">{showAdvanced ? 'Hide' : 'Show'}</span>
					</button>
					{#if showAdvanced}
						<div id="advanced-ocr-options" class="space-y-4 border-t border-[var(--border)]/70 px-5 py-5 text-sm">
							<label class="flex items-center gap-2">
								<input
									type="checkbox"
									class="h-4 w-4"
									bind:checked={autoLanguageDetection}
								/>
								<span>Detect language automatically</span>
							</label>
							{#if !autoLanguageDetection}
								<div class="space-y-1">
									<label class="text-xs uppercase tracking-wide text-[var(--muted-foreground)]"
										>Language hint (ISO code)</label
									>
									<input
										type="text"
										placeholder="e.g. en, fr, ar"
										class="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
										bind:value={languageHint}
									/>
								</div>
							{/if}
							<div class="grid gap-4 md:grid-cols-2">
								<div class="space-y-1">
									<label class="text-xs uppercase tracking-wide text-[var(--muted-foreground)]"
										>Output format</label
									>
									<select
										class="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
										bind:value={outputFormat}
									>
										<option value="raw">Raw text</option>
										<option value="paragraph">Paragraphs</option>
									</select>
								</div>
								<div class="space-y-1">
									<label class="text-xs uppercase tracking-wide text-[var(--muted-foreground)]"
										>OCR mode</label
									>
									<select
										class="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
										bind:value={ocrMode}
									>
										<option value="fast">Fast</option>
										<option value="high_accuracy">High accuracy</option>
									</select>
								</div>
							</div>
							<div class="flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
								<span class="rounded-full border border-[var(--border)] px-2 py-0.5">
									Mode: {ocrMode === 'high_accuracy' ? 'High accuracy' : 'Fast'}
								</span>
								<span class="rounded-full border border-[var(--border)] px-2 py-0.5">
									Format: {outputFormat === 'paragraph' ? 'Paragraphs' : 'Raw'}
								</span>
								<span class="rounded-full border border-[var(--border)] px-2 py-0.5">
									{autoLanguageDetection
										? 'Auto language'
										: languageHint
											? `Language: ${languageHint}`
											: 'Manual language'}
								</span>
							</div>
						</div>
					{/if}
				</div>

				<button
					on:click={analyzeImage}
					class="w-full py-4 rounded-2xl font-semibold text-lg transition duration-300 ease-in-out bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--secondary)] shadow-[0_20px_40px_rgba(215,106,32,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-70"
					disabled={uploading}
				>
					{#if uploading}Uploading...{:else}Analyze image{/if}
				</button>

				{#if uploadError}
					<p class="text-sm text-center text-red-500" role="alert" aria-live="polite">
						{uploadError}
					</p>
				{/if}
				{#if !isLoggedIn}
					<p class="text-center text-xs text-[var(--muted-foreground)]">
						Log in to store uploads on your dashboard.
					</p>
				{/if}
			</div>
		</div>
	</section>

{#if resultText}
		<section class="w-full px-6 mt-16" aria-live="polite">
			<div
				transition:slide
				class="mx-auto mt-4 w-full max-w-3xl bg-[var(--card)] shadow-xl rounded-2xl p-6 border border-[var(--border)] text-[var(--foreground)]"
			>
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm uppercase tracking-wide text-[var(--muted-foreground)]">Upload status</p>
						<p class="text-lg font-semibold">{resultText}</p>
					</div>
					{#if uploadResult}
						<div class="flex flex-wrap justify-end gap-2 text-[11px] uppercase tracking-wide">
							{#each formatOptionLabels(uploadResult) as label}
								<span class="rounded-full border border-[var(--border)] px-2 py-0.5">{label}</span>
							{/each}
						</div>
					{/if}
				</div>

				{#if uploadResult}
					<div class="mt-4 flex flex-wrap items-center gap-3">
						<button
							type="button"
							class="text-sm text-[var(--primary)] underline"
							on:click={() => previewUploadedImage(uploadResult)}
						>
							Preview image
						</button>
						<a href="/dashboard" class="text-sm text-[var(--primary)] underline">Open dashboard</a>
					</div>
				{/if}
			</div>
		</section>
	{/if}

	{#if recentUploads.length > 0}
		<section class="w-full max-w-6xl mx-auto px-6 pb-12 text-[var(--foreground)] mt-12" aria-label="Recent uploads">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold">Recent uploads</h2>
				<p class="text-xs text-[var(--muted-foreground)]">{recentUploads.length} active</p>
			</div>
			<div class="grid gap-4 md:grid-cols-2">
				{#each recentUploads as item (item.id)}
					<div class="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-4 shadow-sm">
						<div class="w-24 h-24 rounded-xl border overflow-hidden flex items-center justify-center bg-[var(--muted)]/40">
							{#if item.previewObjectUrl}
								<img
									src={item.previewObjectUrl}
									alt="Uploaded image preview"
									class="h-full w-full object-cover"
								/>
							{:else}
								<span class="text-xs text-[var(--muted-foreground)]">Preview pending</span>
							{/if}
						</div>
						<div class="flex-1 space-y-2 min-w-0">
							<p class="text-sm font-medium truncate" title={item.id}>{item.id}</p>
							<p class="text-xs text-[var(--muted-foreground)] line-clamp-3">
								{createResultMessage(item)}
							</p>
							<div class="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide">
								{#each formatOptionLabels(item) as label}
									<span class="rounded-full border border-[var(--border)] px-2 py-0.5">{label}</span>
								{/each}
							</div>
							<div class="flex flex-wrap items-center gap-3 text-xs pt-1">
								<button
									type="button"
									class="text-[var(--primary)] underline disabled:text-[var(--muted-foreground)]"
									on:click={() => previewUploadedImage(item)}
									disabled={!item.image_url}
									aria-disabled={!item.image_url}
								>
									Preview
								</button>
								<a href="/dashboard" class="text-[var(--primary)] underline text-xs">View in dashboard</a>
								<button
									type="button"
									class="text-red-500 hover:underline text-xs"
									on:click={() => removeRecentUpload(item.id)}
									aria-label={`Remove ${item.id} from history`}
								>
									Remove
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<footer class="mt-auto border-t border-[var(--border)]/60 bg-[var(--card)]/40 text-[var(--muted-foreground)]">
		<div class="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8 text-center text-sm sm:flex-row sm:items-center sm:justify-between">
			<p>&copy; {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</p>
			<div class="flex flex-wrap justify-center gap-4 text-xs uppercase tracking-wide">
				<a href="/dashboard" class="text-[var(--primary)] hover:underline">Dashboard</a>
				<a href="/documentation" class="text-[var(--primary)] hover:underline">Docs</a>
				<a href="/login" class="text-[var(--primary)] hover:underline">Login</a>
				<a href="/signup" class="text-[var(--primary)] hover:underline">Get Started</a>
			</div>
		</div>
	</footer>
</main>

<style>
	/* تغيير الخط إلى Inter لجميع العناصر */
	@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

	/* لون خلفية صلب مستمد من لوحة الألوان */
	.bg-gradient-soft {
		background-color: var(--home-surface);
	}

	.drop-zone {
		cursor: pointer;
	}

	.drop-zone:focus-visible {
		outline: none;
	}

	.drop-zone--active {
		border-color: var(--primary);
		background-color: rgba(215, 106, 32, 0.2);
		color: var(--primary-foreground);
	}
</style>
