<script lang="ts">
	import { slide } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';
	import Header from './components/header.svelte';
	import { API_ROUTES, toAbsoluteUrl } from '$lib/config';
	import { BRAND_NAME, PRIMARY_TAGLINE } from '$lib/brand';
	import {
		createUploadsWebSocket,
		sendUploadCommand,
		UploadSocketCommands,
		ensureUploadsSocketReady
	} from '$lib/api/uploadsSocket';
	import { notifySuccess } from '$lib/stores/notifications';

	type UploadResponse = {
		id: string;
		image_url?: string | null;
		raw_text?: string | null;
		processed_text?: string | null;
		auto_language_detection?: boolean;
		language_hint?: string | null;
		output_format?: 'raw' | 'paragraph';
		ocr_mode?: 'fast' | 'high_accuracy';
		status?: string;
		streamed_text?: string | null;
		error?: string | null;
	};
	type UploadCard = UploadResponse & { previewObjectUrl?: string | null };

	type UploadSocketMessage = {
		type?: string;
		message?: string;
		model?: string;
		instance_id?: string | null;
		instance?: UploadResponse | null;
		duplicate?: boolean;
		error?: Record<string, string[] | string> | string | null;
		id?: string;
		status?: string;
		streamed_text?: string | null;
		raw_text?: string | null;
		processed_text?: string | null;
		image_url?: string | null;
		answer?: string | null;
		response?: string | null;
		data?: Record<string, unknown> | null;
	};

	type UploadWebsocketRequest = {
		auto_language_detection: boolean;
		language_hint?: string;
		output_format: 'raw' | 'paragraph';
		ocr_mode: 'fast' | 'high_accuracy';
	};

	type ChatMessageRole = 'user' | 'assistant' | 'system';
	type ChatMessage = {
		id: string;
		role: ChatMessageRole;
		text: string;
	};

	let selectedFile: File | null = null;
	let previewUrl: string | null = null;
	let retainedPreviewUrl: string | null = null;
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
	let chatMessages: ChatMessage[] = [];
	let chatInput = '';
	let chatSending = false;
	let chatError = '';
	let activeUploadSocket: WebSocket | null = null;
	let pendingQuestionResolve: ((answer: string) => void) | null = null;
	let pendingQuestionReject: ((error: Error) => void) | null = null;
	let pendingQuestionTimeout: ReturnType<typeof setTimeout> | null = null;
	const WEBSOCKET_TIMEOUT_MS = 60000;
	const QUESTION_TIMEOUT_MS = 20000;

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
		revokeRetainedPreview();
		teardownActiveUploadSocket();
		recentUploads.forEach((item) => cleanupUploadPreview(item));
	});

	function revokePreview() {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
			previewUrl = null;
		}
	}

	function revokeRetainedPreview() {
		if (retainedPreviewUrl) {
			URL.revokeObjectURL(retainedPreviewUrl);
			retainedPreviewUrl = null;
		}
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement | null;
		if (!target) return;
		setSelectedFile(target.files?.[0] ?? null);
		resultText = '';
		uploadError = '';
		uploadResult = null;
		resetChatState();
	}

	function setSelectedFile(file: File | null) {
		revokePreview();
		revokeRetainedPreview();
		selectedFile = file;
		if (file) {
			previewUrl = URL.createObjectURL(file);
		}
	}

	function clearSelectedFile(options: { preserveFeedback?: boolean; retainPreview?: boolean } = {}) {
		const { preserveFeedback = false, retainPreview = false } = options;
		if (retainPreview && previewUrl) {
			retainedPreviewUrl = previewUrl;
			previewUrl = null;
		} else {
			revokePreview();
			revokeRetainedPreview();
		}
		selectedFile = null;
		if (!preserveFeedback) {
			resultText = '';
			uploadError = '';
			uploadResult = null;
			resetChatState();
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
		resultText = '⏳ Connecting to OCR stream...';
		uploadResult = null;

		const metadata: UploadWebsocketRequest = {
			auto_language_detection: autoLanguageDetection,
			output_format: outputFormat,
			ocr_mode: ocrMode
		};
		if (!autoLanguageDetection && languageHint.trim()) {
			metadata.language_hint = languageHint.trim();
		}

		try {
			const upload = await createUploadViaWebsocket({
				file: selectedFile,
				token,
				requestData: metadata,
				onProgress: (status, extras) => handleUploadProgress(status, extras)
			});

			const uploadWithPreview = await withPreview(upload, token);
			const updatedHistory = [
				uploadWithPreview,
				...recentUploads.filter((item) => item.id !== uploadWithPreview.id)
			];
			recentUploads = updatedHistory;
			uploadResult = uploadWithPreview;
			resultText = createResultMessage(uploadWithPreview);
			notifySuccess('Upload processed successfully.');
			resetChatState();
			clearSelectedFile({ preserveFeedback: true, retainPreview: true });
		} catch (error) {
			uploadError = error instanceof Error ? error.message : 'Failed to upload image.';
			resultText = '';
		} finally {
			uploading = false;
		}
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

	function fileToBase64(file: File) {
		return new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result;
				if (typeof result !== 'string') {
					reject(new Error('Failed to read file.'));
					return;
				}
				const commaIndex = result.indexOf(',');
				resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
			};
			reader.onerror = () => {
				reject(new Error('Failed to read file.'));
			};
			reader.readAsDataURL(file);
		});
	}

	type UploadSocketCallbacks = {
		onProgress?: (status: UploadResponse, extras?: { duplicate?: boolean }) => void;
	};

	type CreateUploadViaWebsocketArgs = {
		file: File;
		token: string;
		requestData: UploadWebsocketRequest;
		onProgress?: UploadSocketCallbacks['onProgress'];
	};

	async function createUploadViaWebsocket({
		file,
		token,
		requestData,
		onProgress
	}: CreateUploadViaWebsocketArgs) {
		teardownActiveUploadSocket();
		const imageBase64 = await fileToBase64(file);
		const payloadData: Record<string, unknown> = {
			image_base64: imageBase64,
			auto_language_detection: requestData.auto_language_detection,
			output_format: requestData.output_format,
			ocr_mode: requestData.ocr_mode
		};
		if (requestData.language_hint) {
			payloadData.language_hint = requestData.language_hint;
		}

			return new Promise<UploadResponse>((resolve, reject) => {
				let settled = false;
				let socket: WebSocket | null = null;
				let timeoutId: ReturnType<typeof setTimeout>;
				const cleanup = (shouldClose = true) => {
					if (socket) {
						socket.onopen =
							socket.onmessage =
							socket.onerror =
							socket.onclose =
								null;
						if (
							shouldClose &&
							(socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
						) {
							socket.close();
						}
					}
					if (shouldClose && activeUploadSocket === socket) {
						activeUploadSocket = null;
					}
					socket = null;
				};
				const finishWithError = (message: string) => {
					if (settled) return;
					settled = true;
				clearTimeout(timeoutId);
				cleanup();
				reject(new Error(message));
			};
				const finishWithSuccess = (data: UploadResponse) => {
					if (settled) return;
					settled = true;
					clearTimeout(timeoutId);
					resolve(data);
				};

			timeoutId = setTimeout(() => {
				finishWithError('Upload timed out. Please try again.');
			}, WEBSOCKET_TIMEOUT_MS);

			const handleProgress = (status: UploadResponse, extras?: { duplicate?: boolean }) => {
				onProgress?.(status, extras);
			};

				try {
					socket = createUploadsWebSocket(token);
					activeUploadSocket = socket;
				} catch (error) {
					finishWithError('Failed to open WebSocket connection.');
					return;
				}

			socket.onopen = () => {
				const initializeUpload = async () => {
					try {
						await sendUploadCommand(socket, UploadSocketCommands.subscribe());
						await sendUploadCommand(socket, UploadSocketCommands.create(payloadData));
					} catch (error) {
						console.error('Failed to send create payload', error);
						finishWithError('Unable to send upload payload.');
					}
				};
				void initializeUpload();
			};

				socket.onerror = () => {
					finishWithError('WebSocket error while uploading image.');
				};

				socket.onclose = () => {
					if (activeUploadSocket === socket) {
						activeUploadSocket = null;
						handlePendingQuestionFailure('Live connection closed.');
					}
					if (!settled) {
						finishWithError('Connection closed before upload completed.');
					}
				};

			socket.onmessage = (event) => {
				let payload: UploadSocketMessage;
				try {
					payload = JSON.parse(event.data) as UploadSocketMessage;
				} catch (error) {
					console.error('Failed to parse websocket payload', error);
					return;
				}

				if (!payload?.type) {
					return;
				}

				if (handleQuestionResponseFromSocket(payload)) {
					return;
				}

				if (payload.type === 'Upload.created') {
					if (payload.error) {
						const message = normalizeSocketError(payload.error);
						finishWithError(message);
						return;
					}
					const upload = extractUploadFromPayload(payload);
					if (!upload) return;
					handleProgress(upload, { duplicate: payload.duplicate ?? false });
					if (payload.duplicate) {
						finishWithSuccess(upload);
					}
					return;
				}

				if (payload.type === 'Upload.status') {
					const upload = extractUploadFromPayload(payload);
					if (!upload) return;
					handleProgress(upload);
					const status = upload.status?.toLowerCase();
					if (status === 'processed') {
						finishWithSuccess(upload);
					} else if (status === 'error') {
						const errorMessage = upload.error ?? normalizeSocketError(payload.error);
						finishWithError(errorMessage || 'Upload failed.');
					}
					return;
				}
				
				if (payload.error) {
					const message = normalizeSocketError(payload.error);
					finishWithError(message);
				}
			};
		});
	}

	function extractUploadFromPayload(payload: UploadSocketMessage): UploadResponse | null {
		if (payload.instance) {
			return payload.instance;
		}
		if (!payload.id) {
			return null;
		}
		return {
			id: payload.id,
			status: payload.status,
			streamed_text: payload.streamed_text,
			raw_text: payload.raw_text,
			processed_text: payload.processed_text,
			image_url: payload.image_url
		};
	}

	function handleUploadProgress(status: UploadResponse, extras?: { duplicate?: boolean }) {
		const stage = status.status?.toLowerCase();
		if (extras?.duplicate) {
			resultText =
				status.processed_text ||
				status.raw_text ||
				'Duplicate detected. Returning the most recent OCR output.';
			return;
		}
		if (stage === 'processing') {
			resultText =
				status.streamed_text ||
				status.raw_text ||
				'Processing upload and streaming intermediate OCR results...';
			return;
		}
		if (stage === 'pending' || !stage) {
			resultText = 'Upload created. Waiting for OCR worker to start.';
		}
	}

	function normalizeSocketError(error: Record<string, string[] | string> | string | null | undefined) {
		if (!error) return 'Upload failed.';
		if (typeof error === 'string') return error;
		const messages: string[] = [];
		for (const [field, value] of Object.entries(error)) {
			if (!value) continue;
			if (Array.isArray(value) && value.length > 0) {
				messages.push(`${field}: ${value.join(', ')}`);
			} else if (typeof value === 'string') {
				messages.push(`${field}: ${value}`);
			}
		}
		return messages.length > 0 ? messages.join(' ') : 'Upload failed.';
	}

	function resetChatState() {
		chatMessages = [];
		chatInput = '';
		chatError = '';
		chatSending = false;
		handlePendingQuestionFailure('Question cancelled.');
	}

	function createChatMessage(role: ChatMessageRole, text: string): ChatMessage {
		const id =
			typeof crypto !== 'undefined' && 'randomUUID' in crypto
				? crypto.randomUUID()
				: `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
		return {
			id,
			role,
			text: text.trim()
		};
	}

	function appendChatMessage(message: ChatMessage) {
		chatMessages = [...chatMessages, message];
	}

	function handleChatKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			void handleAskQuestion();
		}
	}

	function clearPendingQuestionTimers(message?: string) {
		if (pendingQuestionTimeout) {
			clearTimeout(pendingQuestionTimeout);
			pendingQuestionTimeout = null;
		}
		if (pendingQuestionReject && message) {
			pendingQuestionReject(new Error(message));
		}
		pendingQuestionResolve = null;
		pendingQuestionReject = null;
	}

	function handlePendingQuestionFailure(message: string) {
		if (!pendingQuestionReject) return;
		const reject = pendingQuestionReject;
		clearPendingQuestionTimers();
		reject(new Error(message));
	}

	function handleQuestionResponseFromSocket(payload: UploadSocketMessage) {
		if (!pendingQuestionResolve) {
			return false;
		}
		const type = payload.type?.toLowerCase() ?? '';
		const hasAnswerField =
			typeof payload.answer === 'string' ||
			(typeof payload.data === 'object' && payload.data !== null && typeof payload.data['answer'] === 'string');
		if (!type.includes('answer') && !type.includes('question') && !hasAnswerField) {
			return false;
		}
		const answer = extractAnswerFromQuestionPayload(payload);
		if (!answer && !payload.error) {
			return false;
		}
		if (payload.error) {
			handlePendingQuestionFailure(normalizeSocketError(payload.error));
			return true;
		}
		const resolver = pendingQuestionResolve;
		clearPendingQuestionTimers();
		resolver(answer ?? 'No answer was returned.');
		return true;
	}

	async function handleAskQuestion() {
		if (chatSending) return;
		const trimmed = chatInput.trim();
		if (!trimmed) return;
		if (!uploadResult) {
			chatError = 'Upload result required before asking questions.';
			return;
		}
		chatError = '';
		appendChatMessage(createChatMessage('user', trimmed));
		chatInput = '';
		chatSending = true;
		try {
			const token = await ensureAccessToken();
			if (!token) {
				throw new Error('Please log in to ask questions.');
			}
			const answer = await submitUploadQuestion({
				token,
				instanceId: uploadResult.id,
				question: trimmed
			});
			appendChatMessage(
				createChatMessage(
					'assistant',
					answer || 'No answer was returned for this question. Please try again.'
				)
			);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Failed to send question. Please try again.';
			if (message !== 'Question cancelled.') {
				chatError = message;
				appendChatMessage(createChatMessage('system', message));
			} else {
				chatError = '';
			}
		} finally {
			chatSending = false;
		}
	}

	type UploadQuestionArgs = {
		token: string;
		instanceId: string;
		question: string;
	};

	async function submitUploadQuestion({
		token,
		instanceId,
		question
	}: UploadQuestionArgs): Promise<string> {
		const payloadQuestion = question.trim();
		if (!payloadQuestion) {
			throw new Error('Question cannot be empty.');
		}
		if (!activeUploadSocket) {
			throw new Error('Live connection unavailable. Please upload again before asking questions.');
		}
		let socket: WebSocket;
		try {
			socket = await ensureUploadsSocketReady(activeUploadSocket);
		} catch (error) {
			throw new Error('Live connection unavailable. Please upload again before asking questions.');
		}
		return await new Promise<string>((resolve, reject) => {
			pendingQuestionResolve = resolve;
			pendingQuestionReject = reject;
			if (pendingQuestionTimeout) {
				clearTimeout(pendingQuestionTimeout);
			}
			pendingQuestionTimeout = setTimeout(() => {
				handlePendingQuestionFailure('Question timed out. Please try again.');
			}, QUESTION_TIMEOUT_MS);
			try {
				socket.send(JSON.stringify(UploadSocketCommands.question(instanceId, payloadQuestion)));
			} catch (error) {
				handlePendingQuestionFailure('Unable to send question payload.');
			}
		});
	}

	function extractAnswerFromQuestionPayload(payload: UploadSocketMessage | null): string | null {
		if (!payload) return null;
		const candidates: Array<string | null | undefined> = [
			payload.answer,
			payload.response,
			typeof payload.message === 'string' &&
			payload.type &&
			payload.type.toLowerCase().includes('answer')
				? payload.message
				: undefined
		];
		if (payload.data && typeof payload.data === 'object') {
			const record = payload.data as Record<string, unknown>;
			for (const key of ['answer', 'response', 'message']) {
				const value = record[key];
				if (typeof value === 'string') {
					candidates.push(value);
				}
			}
		}
		if (payload.instance) {
			const instanceAny = payload.instance as Record<string, unknown>;
			if (typeof instanceAny['answer'] === 'string') {
				candidates.push(instanceAny['answer'] as string);
			}
			if (typeof payload.instance.processed_text === 'string') {
				candidates.push(payload.instance.processed_text);
			} else if (typeof payload.instance.raw_text === 'string') {
				candidates.push(payload.instance.raw_text);
			}
		}
		for (const candidate of candidates) {
			if (candidate && candidate.trim().length > 0) {
				return candidate.trim();
			}
		}
		return null;
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

	async function withPreview(upload: UploadResponse): Promise<UploadCard> {
		return { ...upload, previewObjectUrl: null };
	}

	function getResultImageSource() {
		if (retainedPreviewUrl) {
			return retainedPreviewUrl;
		}
		if (uploadResult?.image_url) {
			return toAbsoluteUrl(uploadResult.image_url);
		}
		return null;
	}

	async function previewUploadedImage(upload: UploadCard | null) {
		if (!upload || !upload.image_url) return;
		window.open(toAbsoluteUrl(upload.image_url), '_blank', 'noopener,noreferrer');
	}

	function teardownActiveUploadSocket() {
		if (pendingQuestionTimeout) {
			clearTimeout(pendingQuestionTimeout);
			pendingQuestionTimeout = null;
		}
		pendingQuestionResolve = null;
		pendingQuestionReject = null;
		if (activeUploadSocket) {
			activeUploadSocket.onopen = activeUploadSocket.onmessage = activeUploadSocket.onerror = activeUploadSocket.onclose = null;
			if (
				activeUploadSocket.readyState === WebSocket.OPEN ||
				activeUploadSocket.readyState === WebSocket.CONNECTING
			) {
				activeUploadSocket.close();
			}
		}
		activeUploadSocket = null;
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
		<section class="w-full px-6 mt-6 mb-16" aria-live="polite">
			<div
				transition:slide
				class="mx-auto mt-2 w-full max-w-3xl bg-[var(--card)] shadow-xl rounded-2xl p-6 border border-[var(--border)] text-[var(--foreground)]"
			>
				<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div class="flex-1">
						<p class="text-sm uppercase tracking-wide text-[var(--muted-foreground)]">Upload status</p>
						<p class="text-lg font-semibold">{resultText}</p>
						{#if uploadResult}
							<div class="mt-4 flex flex-wrap justify-start gap-2 text-[11px] uppercase tracking-wide">
								{#each formatOptionLabels(uploadResult) as label}
									<span class="rounded-full border border-[var(--border)] px-2 py-0.5">{label}</span>
								{/each}
							</div>
						{/if}
					</div>
					{#if getResultImageSource()}
						<div class="mx-auto flex w-full max-w-[200px] flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/30 p-3 lg:mx-0">
							<img
								src={getResultImageSource()}
								alt="Uploaded preview"
								class="h-40 w-full rounded-xl object-cover"
							/>
							<p class="text-xs text-[var(--muted-foreground)]">Latest processed image</p>
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

	{#if uploadResult}
		<section class="w-full px-6 mt-4 mb-12" aria-label="Ask questions about the extracted text">
			<div class="mx-auto w-full max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--card)]/90 p-6 shadow-lg text-[var(--foreground)]">
				<div class="flex flex-col gap-1">
					<p class="text-sm uppercase tracking-wide text-[var(--muted-foreground)]">
						Chat about this upload
					</p>
					<p class="text-xs text-[var(--muted-foreground)]">
						Ask follow-up questions or request clarifications about the extracted text.
					</p>
				</div>

				<div
					class="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1"
					role="log"
					aria-live="polite"
				>
					{#if chatMessages.length === 0}
						<p class="text-sm text-[var(--muted-foreground)]">
							No questions yet. Ask how to interpret the OCR output or request specific formatting tips.
						</p>
					{:else}
						{#each chatMessages as message (message.id)}
							<div class={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
								<div
									class={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
										message.role === 'user'
											? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
											: message.role === 'assistant'
												? 'bg-[var(--muted)]/50 text-[var(--foreground)]'
												: 'bg-amber-100/60 text-amber-900'
									}`}
								>
									{message.text}
								</div>
							</div>
						{/each}
					{/if}
				</div>

				{#if chatError}
					<p class="mt-3 text-sm text-destructive" role="alert">
						{chatError}
					</p>
				{/if}

				<div class="mt-4 flex flex-col gap-3 md:flex-row">
					<textarea
						class="min-h-[80px] flex-1 rounded-2xl border border-[var(--border)] bg-transparent p-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
						placeholder="Ask about important details, summaries, or instructions for this upload..."
						rows="3"
						bind:value={chatInput}
						disabled={chatSending}
						on:keydown={handleChatKeydown}
					/>
					<button
						type="button"
						class="w-full rounded-2xl bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--secondary)] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
						on:click={() => void handleAskQuestion()}
						disabled={chatSending || !chatInput.trim()}
					>
						{chatSending ? 'Sending...' : 'Send'}
					</button>
				</div>
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
