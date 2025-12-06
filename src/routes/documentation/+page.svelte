<script lang="ts">
	import Header from '../components/header.svelte';
</script>

<Header title="Docs" />

<main class="min-h-screen bg-gradient-soft text-[var(--foreground)]">
	<section class="mx-auto w-full max-w-4xl px-6 py-16 space-y-10">
		<div class="space-y-4 text-center">
			<p class="text-xs uppercase tracking-[0.3em] text-[var(--muted-foreground)]">Upload WebSocket API</p>
			<h1 class="text-4xl font-semibold">Live File Status & OCR Streaming</h1>
			<p class="text-base text-[var(--muted-foreground)]">
				Django Channels powers realtime uploads, dedupe, and OCR streaming. Use this guide to connect the client,
				send commands, and process events.
			</p>
			<p class="text-sm text-[var(--muted-foreground)]">
				Main entry: <a class="underline" href="backend_main/backend/asgi.py">backend_main/backend/asgi.py</a> ·
				Consumer: <a class="underline" href="backend_main/core/consumers.py">backend_main/core/consumers.py</a> ·
				OCR tasks: <a class="underline" href="backend_main/core/tasks.py">backend_main/core/tasks.py</a>
			</p>
		</div>

		<section class="rounded-3xl border border-[var(--border)] bg-[var(--card)]/70 p-6 shadow-lg space-y-4">
			<h2 class="text-2xl font-semibold flex items-center gap-2">
				<span aria-hidden="true">📡</span>
				WebSocket Endpoints
			</h2>
			<p>Connect using secure (wss) URLs in production.</p>
			<pre class="rounded-2xl bg-black/70 p-4 text-sm text-white overflow-auto"><code>ws://&lt;server&gt;/ws/core/upload/
ws://&lt;server&gt;/ws/core/upload/&lt;uuid:instance_id&gt;/</code></pre>
			<ul class="list-disc pl-6 text-sm text-[var(--muted-foreground)] space-y-1">
				<li><code>/ws/core/upload/</code> – Subscribe to all uploads for the authenticated user.</li>
				<li><code>/ws/core/upload/&lt;id&gt;/</code> – Stream events for a specific upload.</li>
			</ul>
			<div class="rounded-2xl border border-dashed border-[var(--border)]/70 p-4 text-sm text-[var(--muted-foreground)]">
				<p class="font-semibold text-[var(--foreground)] mb-1">Authentication</p>
				<ul class="list-disc pl-5 space-y-1">
					<li>JWT token required for every connection.</li>
					<li>Pass as query param: <code>?token=&lt;jwt&gt;</code>.</li>
					<li>Only authenticated sockets join upload groups.</li>
				</ul>
			</div>
		</section>

		<section class="rounded-3xl border border-[var(--border)] bg-[var(--card)]/70 p-6 space-y-6">
			<header>
				<h2 class="text-2xl font-semibold flex items-center gap-2">
					<span aria-hidden="true">📑</span>
					Message Patterns & Commands
				</h2>
				<p class="text-sm text-[var(--muted-foreground)]">All payloads use JSON and include a <code>"type"</code> field.</p>
			</header>

			<div class="space-y-3">
				<h3 class="text-lg font-semibold">1️⃣ Subscribe</h3>
				<div class="grid gap-3 md:grid-cols-2">
					<div>
						<p class="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Request</p>
						<pre class="rounded-xl bg-black/70 p-3 text-xs text-white overflow-auto"><code>{ "type": "subscribe" }</code></pre>
					</div>
					<div>
						<p class="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Response</p>
						<pre class="rounded-xl bg-black/70 p-3 text-xs text-white overflow-auto"><code>{
  "message": "subscribed",
  "model": "Upload",
  "instance_id": null
}</code></pre>
					</div>
				</div>
			</div>

			<div class="space-y-3">
				<h3 class="text-lg font-semibold">2️⃣ Create Upload</h3>
				<p class="text-sm text-[var(--muted-foreground)]">Provide either <code>image_base64</code>, <code>image_path</code>, or <code>image_hash</code>.</p>
				<div class="grid gap-3 md:grid-cols-2">
					<div>
						<p class="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Request</p>
						<pre class="rounded-xl bg-black/70 p-3 text-xs text-white overflow-auto"><code>{
  "type": "create",
  "data": {
    "image_base64": "&lt;base64&gt;",
    "image_path": "/srv/uploads/optional.jpg",
    "image_hash": "optional-sha256"
  }
}</code></pre>
					</div>
					<div>
						<p class="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Success</p>
						<pre class="rounded-xl bg-black/70 p-3 text-xs text-white overflow-auto"><code>{
  "type": "Upload.created",
  "instance": { "id": "...", "status": "pending" },
  "duplicate": false
}</code></pre>
						<p class="mt-2 text-xs text-[var(--muted-foreground)]">Duplicate hashes set <code>"duplicate": true</code>. Validation errors return an <code>error</code> object.</p>
					</div>
				</div>
			</div>

			<div class="grid gap-6">
				<div>
					<h3 class="text-lg font-semibold">3️⃣ List Uploads</h3>
					<pre class="rounded-xl bg-black/70 p-3 text-xs text-white overflow-auto"><code>{ "type": "list" }</code></pre>
					<pre class="rounded-xl bg-black/70 p-3 text-xs text-white overflow-auto mt-2"><code>{
  "type": "Upload.list",
  "list": [ { /* Upload */ }, ... ]
}</code></pre>
				</div>
				<div>
					<h3 class="text-lg font-semibold">4️⃣ Retrieve / Status</h3>
					<pre class="rounded-xl bg-black/70 p-3 text-xs text-white overflow-auto"><code>{
  "type": "retrieve",
  "instance_id": "&lt;upload-id&gt;"
}</code></pre>
					<pre class="rounded-xl bg-black/70 p-3 text-xs text-white overflow-auto mt-2"><code>{
  "type": "Upload.status",
  "instance": { /* metadata */ }
}</code></pre>
				</div>
				<div>
					<h3 class="text-lg font-semibold">5️⃣ Update / Delete</h3>
					<div class="grid gap-3 md:grid-cols-2">
						<div>
							<p class="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Update</p>
							<pre class="rounded-xl bg-black/70 p-3 text-xs text-white overflow-auto"><code>{
  "type": "update",
  "instance_id": "&lt;id&gt;",
  "data": { /* fields */ }
}</code></pre>
						</div>
						<div>
							<p class="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Delete</p>
							<pre class="rounded-xl bg-black/70 p-3 text-xs text-white overflow-auto"><code>{
  "type": "delete",
  "instance_id": "&lt;id&gt;"
}</code></pre>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="rounded-3xl border border-[var(--border)] bg-[var(--card)]/70 p-6 space-y-5">
			<header>
				<h2 class="text-2xl font-semibold flex items-center gap-2">
					<span aria-hidden="true">🔄</span>
					Live Status Events
				</h2>
			</header>
			<p class="text-sm text-[var(--muted-foreground)]">All upload actions broadcast to every socket scoped to that user.</p>
			<pre class="rounded-2xl bg-black/70 p-4 text-xs text-white overflow-auto"><code>{
  "type": "Upload.created" | "Upload.updated" | "Upload.deleted" | "Upload.status",
  "instance": { /* latest state */ }
}</code></pre>
		</section>

		<section class="rounded-3xl border border-[var(--border)] bg-[var(--card)]/70 p-6 space-y-5">
			<header>
				<h2 class="text-2xl font-semibold flex items-center gap-2">
					<span aria-hidden="true">🧠</span>
					Live OCR Streaming
				</h2>
				<p class="text-sm text-[var(--muted-foreground)]">See <code>core/tasks.py</code> for worker details.</p>
			</header>
			<div class="space-y-4">
				<div>
					<p class="text-sm font-semibold">Partial OCR (processing)</p>
					<pre class="rounded-xl bg-black/70 p-3 text-xs text-white overflow-auto"><code>{
  "id": "&lt;upload-id&gt;",
  "status": "processing",
  "streamed_text": "&lt;markdown&gt;",
  "type": "Upload.status"
}</code></pre>
				</div>
				<div>
					<p class="text-sm font-semibold">Finished OCR</p>
					<pre class="rounded-xl bg-black/70 p-3 text-xs text-white overflow-auto"><code>{
  "id": "&lt;upload-id&gt;",
  "status": "processed",
  "raw_text": "&lt;markdown&gt;",
  "processed_text": "&lt;optional&gt;",
  "type": "Upload.status"
}</code></pre>
				</div>
				<div>
					<p class="text-sm font-semibold">Errors</p>
					<pre class="rounded-xl bg-black/70 p-3 text-xs text-white overflow-auto"><code>{
  "id": "&lt;upload-id&gt;",
  "status": "error",
  "type": "Upload.status",
  "error": "Description"
}</code></pre>
				</div>
			</div>
		</section>

		<section class="rounded-3xl border border-[var(--border)] bg-[var(--card)]/70 p-6 space-y-4">
			<h2 class="text-2xl font-semibold flex items-center gap-2">
				<span aria-hidden="true">💡</span>
				Notes & Best Practices
			</h2>
			<ul class="list-disc pl-6 space-y-1 text-sm text-[var(--muted-foreground)]">
				<li>All events are realtime and scoped per user.</li>
				<li>Duplicate detection by hash + owner is enforced; check the <code>duplicate</code> flag.</li>
				<li>Large base64 payloads work but impact latency—chunk uploads if needed.</li>
				<li><code>"instance"</code> mirrors the Upload serializer, making it safe to store in caches.</li>
				<li>Errors always include a <code>"type"</code> field for quick filtering.</li>
			</ul>
		</section>

		<section class="rounded-3xl border border-[var(--border)] bg-[var(--card)]/70 p-6 space-y-4">
			<h2 class="text-2xl font-semibold flex items-center gap-2">
				<span aria-hidden="true">🚦</span>
				Example Flow
			</h2>
			<ol class="list-decimal pl-6 space-y-3 text-sm text-[var(--muted-foreground)]">
				<li>Connect with the JWT token appended to the query string.</li>
				<li>Send <code>{ "type": "create", "data": { "image_base64": "&lt;...&gt;" } }</code>.</li>
				<li>Receive <code>Upload.created</code>, streaming <code>Upload.status</code>, and the final processed event.</li>
				<li>Keep the socket open to receive updates for any other uploads created by the same user.</li>
			</ol>
			<p class="text-xs text-[var(--muted-foreground)]">
				Need JWT signing details or hostnames? Coordinate with the backend team for the latest configuration.
			</p>
		</section>
	</section>
</main>
