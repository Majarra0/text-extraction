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
	let name = '';
	let email = '';
	let password = '';
	let loading = false;
	let error = '';

	// Replace "/api/auth/signup" with your real backend endpoint
	async function handleSignup(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';
		try {
			const normalizedEmail = email.trim();
			const res = await fetch(API_ROUTES.auth.signup, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					email: normalizedEmail,
					username: normalizedEmail,
					password
				})
			});

			const data = await res.json();

			if (!res.ok) {
				error = data.error || 'Signup failed';
				return;
			}

			// Save auth info after signup
			localStorage.setItem('access', data.access);
			localStorage.setItem('refresh', data.refresh);
			localStorage.setItem('user', JSON.stringify(data.user));

			// Redirect after signup
			window.location.href = '/dashboard';
		} catch (err) {
			error = 'Network error';
			console.error(err);
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-4 px-4">
	<p class="text-sm uppercase tracking-[0.2em] text-gray-500 text-center">Yo, get your text instantly.</p>
	<Card class="w-[380px] shadow-md">
		<CardHeader class="text-center">
			<CardTitle class="text-xl">Create an Account</CardTitle>
			<CardDescription>Join us and get started</CardDescription>
		</CardHeader>

		<CardContent class="space-y-4">
			{#if error}
				<p class="text-red-500 text-sm text-center">{error}</p>
			{/if}

			<form class="grid gap-4" on:submit={handleSignup}>
				<div class="grid gap-1">
					<Label>Name</Label>
					<Input bind:value={name} type="text" placeholder="Your Name" required />
				</div>

				<div class="grid gap-1">
					<Label>Email</Label>
					<Input bind:value={email} type="email" placeholder="example@mail.com" required />
				</div>

				<div class="grid gap-1">
					<Label>Password</Label>
					<Input
						bind:value={password}
						type="password"
						placeholder="********"
						minlength="6"
						required
					/>
				</div>

				<Button type="submit" disabled={loading} class="w-full">
					{#if loading}Creating account...{:else}Sign up{/if}
				</Button>
			</form>
		</CardContent>

		<CardFooter class="justify-center text-sm">
			Already have an account?
			<a href="/login" class="text-blue-500 ml-1 underline">Login</a>
		</CardFooter>
	</Card>
</div>
