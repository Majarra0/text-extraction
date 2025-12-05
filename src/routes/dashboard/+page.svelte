<script lang="js">
	import { Activity, CreditCard, DollarSign, Users, Search, Bell, Menu } from 'lucide-svelte';

	// Ensure shadcn-svelte is initialized in your project. If you see config errors, run:
	// npx shadcn-svelte@latest init

	// Import UI components only if they exist. If you get import errors, generate them with shadcn-svelte:
	// npx shadcn-svelte@latest add button card table avatar input
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Input } from '$lib/components/ui/input';

	// Mock Data for Recent Sales
	const recentSales = [
		{
			name: 'Olivia Martin',
			email: 'olivia.martin@email.com',
			amount: '+$1,999.00',
			initials: 'OM'
		},
		{ name: 'Jackson Lee', email: 'jackson.lee@email.com', amount: '+$39.00', initials: 'JL' },
		{
			name: 'Isabella Nguyen',
			email: 'isabella.nguyen@email.com',
			amount: '+$299.00',
			initials: 'IN'
		},
		{ name: 'William Kim', email: 'will@email.com', amount: '+$99.00', initials: 'WK' },
		{ name: 'Sofia Davis', email: 'sofia.davis@email.com', amount: '+$39.00', initials: 'SD' }
	];
</script>

<div class="flex min-h-screen flex-col">
	<header
		class="border-b px-6 py-3 flex items-center justify-between sticky top-0 bg-background z-10"
	>
		<div class="flex items-center gap-4">
			<h1 class="text-xl font-bold tracking-tight">Dashboard</h1>
			<nav class="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground ml-6">
				<a href="##" class="text-foreground transition-colors hover:text-foreground">Overview</a>
				<a href="##" class="transition-colors hover:text-foreground">Customers</a>
				<a href="##" class="transition-colors hover:text-foreground">Products</a>
				<a href="##" class="transition-colors hover:text-foreground">Settings</a>
			</nav>
		</div>

		<div class="flex items-center gap-4">
			<div class="relative hidden sm:block">
				<Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
				<Input type="search" placeholder="Search..." class="w-[200px] pl-8 lg:w-[300px]" />
			</div>
			<Button variant="outline" size="icon" class="rounded-full" disabled={false}>
				<Bell class="h-4 w-4" />
			</Button>
			<Avatar.Root class="h-8 w-8 cursor-pointer">
				<Avatar.Image src="https://github.com/shadcn.png" alt="@shadcn" class="" />
				<Avatar.Fallback class="">CN</Avatar.Fallback>
			</Avatar.Root>
		</div>
	</header>

	<main class="flex-1 space-y-4 p-8 pt-6">
		<div class="flex items-center justify-between space-y-2">
			<h2 class="text-3xl font-bold tracking-tight">Overview</h2>
			<div class="flex items-center space-x-2">
				<Button class="" disabled={false}>Download Report</Button>
			</div>
		</div>

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<Card.Root class="">
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Total Revenue</Card.Title>
					<DollarSign class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content class="">
					<div class="text-2xl font-bold">$45,231.89</div>
					<p class="text-xs text-muted-foreground">+20.1% from last month</p>
				</Card.Content>
			</Card.Root>

			<Card.Root class="">
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Subscriptions</Card.Title>
					<Users class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content class="">
					<div class="text-2xl font-bold">+2350</div>
					<p class="text-xs text-muted-foreground">+180.1% from last month</p>
				</Card.Content>
			</Card.Root>

			<Card.Root class="">
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Sales</Card.Title>
					<CreditCard class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content class="">
					<div class="text-2xl font-bold">+12,234</div>
					<p class="text-xs text-muted-foreground">+19% from last month</p>
				</Card.Content>
			</Card.Root>

			<Card.Root class="">
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Active Now</Card.Title>
					<Activity class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content class="">
					<div class="text-2xl font-bold">+573</div>
					<p class="text-xs text-muted-foreground">+201 since last hour</p>
				</Card.Content>
			</Card.Root>
		</div>

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
			<Card.Root class="col-span-4">
				<Card.Header class="">
					<Card.Title class="">Overview</Card.Title>
				</Card.Header>
				<Card.Content class="pl-2">
					<div
						class="h-[300px] w-full flex items-end justify-between gap-2 p-4 border rounded bg-muted/20"
					>
						{#each Array(12) as _, i}
							<div
								class="w-full bg-primary/90 rounded-t-sm hover:bg-primary transition-all"
								style="height: {Math.floor(Math.random() * 80) + 20}%"
							></div>
						{/each}
					</div>
					<p class="text-center text-xs text-muted-foreground mt-2">Jan - Dec 2024</p>
				</Card.Content>
			</Card.Root>

			<Card.Root class="col-span-3">
				<Card.Header class="">
					<Card.Title class="">Recent Sales</Card.Title>
					<Card.Description class="">You made 265 sales this month.</Card.Description>
				</Card.Header>
				<Card.Content class="">
					<div class="space-y-8">
						{#each recentSales as sale}
							<div class="flex items-center">
								<Avatar.Root class="h-9 w-9">
									<Avatar.Fallback class="">{sale.initials}</Avatar.Fallback>
								</Avatar.Root>
								<div class="ml-4 space-y-1">
									<p class="text-sm font-medium leading-none">{sale.name}</p>
									<p class="text-sm text-muted-foreground">{sale.email}</p>
								</div>
								<div class="ml-auto font-medium">{sale.amount}</div>
							</div>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</main>
</div>
