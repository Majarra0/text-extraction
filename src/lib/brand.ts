export const BRAND_NAME = 'YOCR';
export const PRIMARY_TAGLINE = 'Yo, OCR your files!';
export const ALT_TAGLINES = [
	'Yo, get your text instantly.',
	'Yo—give me that image, I’ll read it.',
	'OCR that says Yo back.',
	'Yo, let me extract that for you.'
];

export function getRandomTagline(includePrimary = false) {
	const pool = includePrimary ? [PRIMARY_TAGLINE, ...ALT_TAGLINES] : ALT_TAGLINES;
	if (pool.length === 0) return PRIMARY_TAGLINE;
	const index = Math.floor(Math.random() * pool.length);
	return pool[index] ?? PRIMARY_TAGLINE;
}
