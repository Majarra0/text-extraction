import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/postcss';
export default {
	plugins: [sveltekit(), tailwindcss()],
	optimizeDeps: {
		include: ['bits-ui']
	},
	ssr: {
		noExternal: ['bits-ui']
	}
};
