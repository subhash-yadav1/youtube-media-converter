# SEO notes — YouTube Media Converter

This file contains recommended keywords, page title templates, meta descriptions, and next steps to improve search ranking.

## Brand / Title
- Primary site title: **YouTube Media Converter**
- Short title (favicon / social): **YouTube Media**

## Recommended keywords (high relevance)
- youtube to mp4
- youtube to mp3
- youtube downloader
- youtube thumbnail downloader
- youtube thumbnail hd
- youtube thumbnail high quality
- free youtube converter
- youtube media converter

## Meta title and description templates
- Home page title: `YouTube Media Converter — Free YouTube to MP4, MP3 & HD Thumbnails`
- Home description: `Convert YouTube to MP4, MP3, and download HD thumbnails. Fast, free, and privacy-focused.`

## Page-level SEO recommendations
- For each conversion result page, set the page title to: `Convert {VIDEO_TITLE} to MP4 — YouTube Media Converter`
- Include a canonical tag pointing to the main page or the canonical video URL when appropriate.
- Add structured data (JSON-LD) for `WebSite` and `Organization` with `sameAs` links if available.

## Content & UX
- Add an FAQ section with headings for common queries: "How to convert YouTube to MP4?", "Is it free?", "Do you store my files?" — these target featured snippets.
- Add clear CTAs and short guides: 1) Paste link 2) Inspect 3) Choose quality 4) Download.

## Off-site and technical SEO
- Register the site with Google Search Console and submit `https://your-domain.com/sitemap.xml`.
- Add Open Graph / Twitter card images (1200x630) for better social sharing.
- Ensure pages load fast (optimize images, enable caching, use CDN). Use Lighthouse to check SEO/accessibility/performance.

## Next steps for this repo
1. Replace `https://your-domain.com` in `public/robots.txt` and `public/sitemap.xml` with your Vercel domain.
2. Add production `NEXT_PUBLIC_SITE_URL` in Vercel env vars.
3. Add per-page metadata for dynamic video pages (title/description) using the app router `generateMetadata` pattern.
4. Run Lighthouse and fix issues (mobile viewport, meta description length, image dimensions).
