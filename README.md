# Crochet Ideas

A custom English-language crochet catalog and journal, with a separate private admin studio. Prices are in USD. Purchases happen on Etsy.

## Run in VS Code

1. Open this `crochet-ideas` folder in VS Code.
2. Install Node.js 24 LTS or later if it is not already available.
3. Open the terminal in this folder and run `npm run dev`.
4. Open **http://localhost:3000** for the website and **http://localhost:3000/admin** for the admin studio.

There are no third-party runtime packages to install. The server uses Node's built-in HTTP, cryptography, and SQLite modules.

### First administrator account

On the first run, a random one-time setup code is saved in `.data/setup-token.txt`. Open this file locally and copy its contents into the admin setup form. Choose your own email and password (at least 12 characters). No default password or administrator account is shipped. The setup endpoint becomes unavailable once an account is created.

The studio is protected by password hashing, expiring server-side sessions, HttpOnly/SameSite cookies, origin checks, and login rate limits. Use HTTPS in production. No email recovery service is configured; local recovery is described below.

## What you can manage

- **Patterns:** name, price, Etsy listing link, collection, photo, image description, description, skill level, featured placement, draft/published status, and SEO fields.
- **Collections:** create, edit, publish and delete collections. Move assigned patterns before deleting a collection.
- **Journal:** articles, introductory text, cover image, category, formatting toolbar, live preview, word count, drafts, publication, and SEO fields. The editor uses a small, safe Markdown subset rather than arbitrary HTML.
- **SEO:** titles, meta descriptions, focus phrase checks, alt text, readable URLs, search previews, canonical links, social tags, sitemap, robots.txt, and structured data. These checks do not predict Google rankings.
- **Settings:** logo, hero photo and text, about copy, Etsy shop link, social sharing image, Google and Bing verification codes.
- **Overview:** published content counts, page requests and Etsy outbound clicks over the last 30 days. These are not unique visitor counts or Etsy sales. Signed-in administrator requests are excluded from page view totals. No third-party analytics scripts are installed.
- **Account:** password change, session invalidation, and sign-out.
- **Export:** protected JSON export of content and settings. Uploaded image binaries and login data are not included.

### Demo content and reference images

The sample products have sample prices and are clearly marked. They have **no Etsy checkout link** until you add your real URL. Uncheck **This is a sample product** after entering your real product details. The sample article is a draft; it does not appear on the public blog until published.

The initial photos and logo use CSS cropping of the two reference screenshots supplied by the project owner. The original PNGs are copied unchanged into `public/assets/`. Replace these references with individual uploaded images in the studio for better image quality and smaller downloads. The hero layout is responsive, but screenshot crops are not standalone original photos. Exact visual identity at all viewport widths depends on the supplied fonts and source assets.

Blog drafts and draft patterns return 404 publicly and are omitted from the sitemap. Renaming a page's slug creates a permanent redirect from its previous URL.

## Files

- `server.mjs`: HTTP server, authentication, CRUD, uploads, SEO endpoints and analytics.
- `lib/render.mjs`: server-rendered public HTML, accessible icons, escaped Markdown.
- `lib/seed.mjs`: initial sample content.
- `public/site.css` and `public/site.js`: responsive storefront styling and saved patterns.
- `public/admin.*`: private content studio UI.
- `.data/crochet.sqlite`: persistent content, settings, sessions and aggregated counts.
- `public/uploads/`: original uploaded PNG, JPG and WebP files, with generated filenames.
- `test/app.test.mjs`: integration tests with a temporary, separate database and uploads folder.

Saved patterns are browser-local preferences. Products, settings, collections, articles and accounts are persisted on the server in SQLite.

## Checks

```sh
npm run check
npm test
```

## Hosting later

This is a **Node.js application**, not a static HTML-only site or a WordPress theme. Choose a host that supports a continuously running **Node.js 24+** process and persistent disk. If purchasing through Namecheap, verify that the specific hosting plan supports these requirements; owning a domain alone does not run the application. A VPS or another Node host can use a Namecheap domain.

1. Upload the project source and use `npm start` as the startup command.
2. Set `NODE_ENV=production`, `HOST=0.0.0.0`, the platform's `PORT`, and `SITE_URL=https://your-domain.example`.
3. Set `DATA_DIR` and `UPLOAD_DIR` to private persistent storage locations. Do not use ephemeral container storage.
4. Serve the app through an HTTPS reverse proxy. Keep the database, setup token, environment files, and backup copies outside the public web root.
5. Bind your domain through your host's instructions and enable TLS before using the production admin login.
6. Set up the admin account, replace sample products and links, and add a standalone social preview image.
7. Verify the domain in Google Search Console using the settings page and submit `https://your-domain.example/sitemap.xml`.

The app deliberately refuses to start in production without an HTTPS `SITE_URL`. Production session cookies have the Secure flag. The current implementation is intended for one server instance; do not run multiple independent replicas against separate data folders. Rate limiting is in memory and applies per direct client address; behind a proxy it may apply to all users together. Harden public deployment with platform-level throttling and backups as appropriate.

No domain has been purchased, no production account connected, and no site deployed by this project. Local setup remains separate from later hosting.

### Environment file

Copy `.env.example` to `.env` if desired and start with:

```sh
node --env-file=.env server.mjs
```

The `npm start` command reads environment variables supplied by your host. It does not automatically load `.env`.

### Backups and recovery

Stop the server before copying the complete `.data/` directory and uploaded-image folder to a private backup location. Keeping the server stopped ensures the SQLite database and its write-ahead log are copied consistently. The JSON export is useful for reviewing and moving content, but is not a full backup or a one-click restore file. To restore a full backup, stop the server, restore these folders to their original locations, and restart.

If you forget the administrator password, stop the server and run:

```sh
node reset-admin.mjs --confirm
```

This removes only the administrator login and sessions, preserves content, and creates a new setup code. Restart, open `/admin`, and create your new account. Use the same `DATA_DIR` environment value used by the server.

### Known scope

- No Etsy API connection: edits change this catalog, not your Etsy listings. Etsy sales, inventory, refunds and downloads remain managed on Etsy.
- No fabricated review counts, sales figures, star ratings, or SEO rankings.
- The editor supports headings, paragraphs, bold, italic, lists, quotations and HTTPS links. It is not a full document editor and does not currently support inline image galleries, revisions or scheduled publishing.
- One administrator account. There is no user registration, multiple staff roles, email delivery, automatic image optimization or cloud storage integration.
- Content is English; the storefront displays USD. The Etsy listing is authoritative for purchase price and availability.
