<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		CardFooter
	} from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { API_ROUTES } from '$lib/config';

	// Form State
	let email = '';
	let password = '';
	let loading = false;
	let error = '';

	// Example login handler (replace /api/auth/login with your backend route)
	async function handleLogin(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';
		try {
			const normalizedEmail = email.trim();
			const res = await fetch(API_ROUTES.auth.login, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: normalizedEmail,
					username: normalizedEmail,
					password
				})
			});

			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Invalid credentials';
				return;
			}

			// Save auth data
			//   {
			// "id": "0267419b-80c7-4e18-903b-21a9af00fd21",
			// "email": "hh@gmail.com",
			// "role": "demo_user",
			// "last_ip": null
			// }
			localStorage.setItem('access', data.access);
			localStorage.setItem('refresh', data.refresh);
			localStorage.setItem('user', JSON.stringify(data.user));

			// Redirect after login
			window.location.href = '/dashboard';
		} catch (err) {
			error = 'Network error';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
	<p class="text-sm uppercase tracking-[0.2em] text-gray-500 text-center">
		Yo—give me that image, I’ll read it.
	</p>
	<Card class="w-[380px] shadow-md">
		<CardHeader class="text-center">
			<CardTitle class="text-xl">Welcome Back</CardTitle>
			<CardDescription>Login to continue</CardDescription>
		</CardHeader>

		<CardContent class="space-y-4">
			{#if error}
				<p class="text-red-500 text-sm text-center">{error}</p>
			{/if}

			<form class="grid gap-4" on:submit={handleLogin}>
				<div class="grid gap-1">
					<Label>Email</Label>
					<Input bind:value={email} type="email" placeholder="example@mail.com" required />
				</div>

				<div class="grid gap-1">
					<Label>Password</Label>
					<Input bind:value={password} type="password" placeholder="********" required />
				</div>

				<Button type="submit" disabled={loading} class="w-full">
					{#if loading}Logging in...{:else}Login{/if}
				</Button>
			</form>
		</CardContent>

		<CardFooter class="justify-center text-sm">
			Don't have an account?
			<a href="/signup" class="text-blue-500 ml-1 underline">Sign up</a>
		</CardFooter>
	</Card>
</div>
