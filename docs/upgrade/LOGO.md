<!-- clinexia-upgrade:phase7 -->
# Logo replacement

The Clinexia mark was replaced everywhere it is drawn or exported, using the supplied `android-chrome-512x512.png`.

## What changed

**Drawn in code**
- Web header and landing navigation: now `components/brand/logo-mark.tsx`, an SVG that takes its colour from the text colour (light mode `#0059e9`, dark mode a lighter blue for contrast). It replaces the generic `Activity` icon.
- Android splash animation (`lib/splash.ts`): the old traced line is replaced by the new mark as a filled outline. The sweeping highlight is clipped to the outline. The mark fades from white to `#0059e9` as it lands on the header logo.
- Mobile header, drawer and About page use `public/icon-192x192.png`, so they pick up the new mark automatically.
- The vector lives in `lib/brand/logo-path.ts`. It is the single source for the in-app logo and the splash.

**Image files (web)**: `public/icon-192x192.png`, `icon-512x512.png`, `icon-maskable-192x192.png`, `icon-maskable-512x512.png`, `apple-touch-icon.png`, `favicon.ico` (16, 32, 48 px), `og-image.png`, `landing/og.png`, `logo.svg`. If present: `android-chrome-*`, `favicon-16x16.png`, `favicon-32x32.png` and the `public/favicon_io/` set.

**Image files (mobile)**: the same `public/` set, Play Store `icon-512.png` and `feature-graphic.png`, every Android launcher icon (`ic_launcher`, `ic_launcher_round`, adaptive `ic_launcher_foreground`) and every `splash.png` in `android/app/src/main/res` and its mirror `resources/android/res`.

Each file keeps the style it already had: blue mark on transparent for "any" icons, white mark on the brand blue for maskable, adaptive, Play Store and legacy launcher icons, blue on white for the Apple icon, white on navy for splash screens. Marks keep the size and position of the old ones.

## Two things you should know

1. **The supplied PNG had hidden specks.** About 390 near-white pixels (some more than 50% opaque) sat in its transparent area. They are invisible on white but show as noise on dark backgrounds. Every file here was drawn from a cleaned vector trace, not from the PNG's pixels.
2. **The mark is a filled shape, not a stroke.** The horizontal bars are about 28 px thick and the spike is thinner. That is why the splash now fills the outline instead of stroking a line.

## Not changed

- **Screenshots** (`public/screenshots`, `public/landing/*.webp`, Play Store screenshots) are pictures of the app UI and still show the old logo in their headers. Re-capture them after you run the new build.
- The OG image and Play feature graphic: only the logo tile was replaced. The headline, wording and device mockups are untouched. A file you have edited yourself is skipped with a message, not overwritten.
- Brand colours (`#2563eb` theme colour, the navy splash) are unchanged.

## After running

1. Hard-reload the site and check the tab icon, the header (light and dark) and the install prompt.
2. Rebuild the Android app and uninstall the old one before installing, because Android caches launcher icons.
3. Check the OG image with a link-preview tool (social sites cache the old image for days).
