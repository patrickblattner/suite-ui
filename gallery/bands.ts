// A 2000 × 1000 stand-in in four bands, with an arrow pointing right across the middle half, so the
// crop and the flip read at a glance.
const BANDS = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1000" viewBox="0 0 2000 1000">' +
    '<rect width="500" height="1000" fill="#c0392b"/><rect x="500" width="500" height="1000" fill="#2e86c1"/>' +
    '<rect x="1000" width="500" height="1000" fill="#28b463"/><rect x="1500" width="500" height="1000" fill="#d4ac0d"/>' +
    '<path d="M600 420 H1250 V300 L1450 500 L1250 700 V580 H600 Z" fill="#ffffff"/></svg>',
)}`;

// The same bands drawn to any box (`preserveAspectRatio="none"`), so a frame that changes the image's
// ratio shows the distortion instead of letterboxing it (`SUI-FEATURE-312`).
const BANDS_STRETCHABLE = BANDS.replace(
  encodeURIComponent('viewBox="0 0 2000 1000"'),
  encodeURIComponent('viewBox="0 0 2000 1000" preserveAspectRatio="none"'),
);

export { BANDS, BANDS_STRETCHABLE };
