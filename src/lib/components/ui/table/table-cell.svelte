<script>
	import { cn } from '$lib/utils.js';
	let { ref = $bindable(null), class: className, children, ...restProps } = $props();
</script>

<td
	bind:this={ref}
	data-slot="table-cell"
	class={cn(
		'max-height-[100px] text-wrap bg-clip-padding p-2 px-4 align-middle [&:has([role=checkbox])]:pe-0',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</td>
