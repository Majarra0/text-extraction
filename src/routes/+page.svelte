<script lang="ts">
	import { slide } from 'svelte/transition';
	import { onMount } from 'svelte';
	import Header from './components/header.svelte';
	import { API_ROUTES, toAbsoluteUrl } from '$lib/config';

	type UploadResponse = {
		id: string;
		image_url?: string | null;
		raw_text?: string | null;
		processed_text?: string | null;
	};

	type ErrorResponse = {
		message?: string;
		errors?: Record<string, string[] | string>;
	};

	let selectedFile: File | null = null;
	let resultText = '';
	let isLoggedIn = false;
	let uploading = false;
	let uploadError = '';
	let uploadResult: UploadResponse | null = null;

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

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement | null;
		if (!target) return;
		selectedFile = target.files?.[0] ?? null;
		resultText = '';
		uploadError = '';
		uploadResult = null;
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
			let response = await uploadFile(token, selectedFile);

			if (response.status === 401) {
				const refreshed = await refreshAccessToken();
				if (!refreshed) {
					throw new Error('Session expired. Please log in again.');
				}
				response = await uploadFile(refreshed, selectedFile);
			}

			if (!response.ok) {
				const message = await buildErrorMessage(response);
				throw new Error(message);
			}

			const upload = (await response.json()) as UploadResponse;
			uploadResult = upload;
			resultText = createResultMessage(upload);
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
</script>

<Header title="OCR"></Header>

<main class="flex flex-col min-h-screen font-inter bg-gradient-soft">
	<section class="flex flex-col items-center justify-center flex-1 p-8">
		<h1 class="text-4xl font-extrabold mb-4 text-gray-800 tracking-tight">AI Image Insight</h1>
		<p class="text-lg text-gray-500 mb-10">Upload any image to get an instant deep analysis.</p>

		<div
			class="w-full max-w-lg bg-white transition duration-300 rounded-xl p-8 border border-gray-100"
		>
			<label for="image-upload" class="block mb-4 text-center text-sm font-medium text-gray-600">
				{selectedFile
					? `File Selected: ${selectedFile.name}`
					: 'Select an image file (PNG, JPG, HEIC)'}
			</label>

			<input
				id="image-upload"
				type="file"
				accept="image/*"
				class="hidden"
				on:change={handleFileChange}
			/>

			<button
				type="button"
				on:click={triggerFileDialog}
				class="w-full mb-6 py-3 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition duration-200"
			>
				Browse Files
			</button>

			<button
				on:click={analyzeImage}
				class="w-full py-3 bg-linear-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-lg font-bold text-lg shadow-lg shadow-blue-300/50 transition duration-300 ease-in-out transform hover:scale-[1.01]"
				disabled={uploading}
			>
				{#if uploading}Uploading...{:else}Analyze Image Now{/if}
			</button>

			{#if uploadError}
				<p class="mt-4 text-sm text-center text-red-600">{uploadError}</p>
			{/if}
			{#if !isLoggedIn}
				<p class="mt-2 text-center text-xs text-gray-500">
					Log in to store uploads on your dashboard.
				</p>
			{/if}
		</div>

		{#if resultText}
			<div
				transition:slide
				class="mt-8 w-full max-w-lg bg-white shadow-xl rounded-xl p-6 border-l-4 border-blue-500 text-gray-800 animate-fadeIn"
			>
				<p class="font-semibold text-base leading-relaxed">
					{resultText}
				</p>
				{#if uploadResult}
					<div class="mt-4 text-sm text-gray-500 space-y-1">
						<p>Upload ID: {uploadResult.id}</p>
						{#if uploadedImageEndpoint}
							<p class="break-all">
								Image endpoint:
								<span class="text-blue-600">{uploadedImageEndpoint}</span>
							</p>
						{/if}
						<a href="/dashboard" class="text-blue-600 underline text-sm">Open dashboard</a>
					</div>
				{/if}
			</div>
		{/if}
	</section>

	<footer class="bg-white border-t border-gray-100">
		<div class="max-w-7xl mx-auto px-4 py-4 text-center text-gray-400 text-xs">
			&copy; 2025 VisionAI. All rights reserved. Built with Svelte and Tailwind CSS.
		</div>
	</footer>
</main>

<style>
	/* تغيير الخط إلى Inter لجميع العناصر */
	@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

	/* تدرج خفيف للخلفية بدلاً من اللون الرمادي الثابت */
	.bg-gradient-soft {
		background: linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%);
	}
</style>
