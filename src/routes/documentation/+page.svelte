<script lang="ts">
	import Header from '../components/header.svelte';
</script>

<Header title="Docs"></Header>

<main class="min-h-screen bg-gradient-soft text-[var(--foreground)]">
	<section class="mx-auto w-full max-w-4xl px-6 py-16 space-y-10">
		<div class="space-y-4 text-center">
			<p class="text-xs uppercase tracking-[0.3em] text-[var(--muted-foreground)]">Open source</p>
			<h1 class="text-4xl font-semibold">Text Extraction Documentation</h1>
			<p class="text-base text-[var(--muted-foreground)]">
				This project is maintained in the open. Use these notes to run the stack locally, contribute new
				features, or embed the OCR workflow into your apps.
			</p>
		</div>

		<div class="space-y-6 rounded-3xl border border-[var(--border)] bg-[var(--card)]/70 p-8 shadow-lg">
			<h2 class="text-2xl font-semibold">Getting started locally</h2>
			<ol class="list-decimal space-y-2 pl-6 text-sm text-[var(--muted-foreground)]">
				<li>Clone the repository and install dependencies with <code>npm install</code>.</li>
				<li>Copy <code>.env.example</code> to <code>.env</code> and fill in API keys.</li>
				<li>Run the client with <code>npm run dev</code>. The OCR API can be mocked or pointed at a live server.</li>
			</ol>
		</div>

		<div class="grid gap-6 md:grid-cols-2">
			<section class="rounded-2xl border border-[var(--border)] bg-[var(--card)]/70 p-6 shadow">
				<h3 class="text-xl font-semibold mb-2">Contributing</h3>
				<p class="text-sm text-[var(--muted-foreground)]">
					Open an issue describing the problem or idea, then submit a pull request once tests pass. Please keep
					commits scoped and document UI changes with screenshots.
				</p>
			</section>
			<section class="rounded-2xl border border-[var(--border)] bg-[var(--card)]/70 p-6 shadow">
				<h3 class="text-xl font-semibold mb-2">API overview</h3>
				<p class="text-sm text-[var(--muted-foreground)]">
					The app targets the <code>/uploads</code> endpoint with Bearer tokens. Responses include processed
					text, options, and a preview URL. See <code>src/lib/config.ts</code> for the current base URLs.
				</p>
			</section>
		</div>

		<div class="rounded-2xl border border-dashed border-[var(--border)]/80 bg-[var(--card)]/50 p-6 text-sm text-[var(--muted-foreground)]">
			<p class="font-semibold text-[var(--foreground)] mb-1">Need help?</p>
			<p>
				Join discussions in the repository, or reach out via issues for guidance on deployment, providers, and
				roadmap questions.
			</p>
		</div>
	</section>
</main>
