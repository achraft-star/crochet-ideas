# Deploy from GitHub to Namecheap

Repository: https://github.com/achraft-star/crochet-ideas.git

These instructions use the existing Node app shown in cPanel: `crochet_ideas`, on `abodabi.shop`. GitHub stores the source; Namecheap runs the website. Your existing hosting subscription still applies.

## 1. Pull the repository into cPanel

Open **cPanel → Git Version Control → Create**:

- Enable **Clone a Repository**.
- Clone URL: `https://github.com/achraft-star/crochet-ideas.git`
- Repository Path: use the full home path suggested by cPanel, ending in `/repositories/crochet-ideas`.
- Repository Name: `crochet-ideas`.

Use a separate, empty checkout directory. Do not clone over the existing `crochet_ideas` app or its data. If the repository is already listed, use **Manage** instead of creating another clone.

For a private GitHub repository, cPanel needs a read-only GitHub deploy key. Do not put a GitHub access token into the clone URL or commit it. Configure private repository access using cPanel's SSH workflow first, then use the SSH clone URL.

## 2. Deploy the source

In the repository's **Manage → Pull or Deploy** tab:

1. Choose **Update from Remote** to retrieve the latest `main` branch.
2. Choose **Deploy HEAD Commit**.

The checked-in `.cpanel.yml` runs `scripts/deploy-cpanel.sh`, which copies the application code into `$HOME/crochet_ideas`. It preserves existing `.data`, `public/uploads`, `.env`, `node_modules`, and cPanel configuration. It requests a Passenger restart through `tmp/restart.txt`.

This is a manual pull/deploy workflow: a push to GitHub alone does not update Namecheap automatically.

## 3. Set up the existing Node.js app

Open **cPanel → Setup Node.js App → abodabi.shop** and set:

| Field | Value |
| --- | --- |
| Node.js version | 24.21.0, or a newer 24.x release offered by your host |
| Application mode | Production |
| Application root | `crochet_ideas` |
| Application URL | `abodabi.shop`, with the path field empty |
| Application startup file | `app.cjs` |

Under **Environment variables**, add:

| Name | Value |
| --- | --- |
| `SITE_URL` | `https://abodabi.shop` |

Production mode supplies `NODE_ENV=production`. There is no need to add a fixed `PORT`: Passenger manages the listening socket. This project has no third-party runtime dependencies, so **Run NPM Install** is not normally needed.

Keep `DATA_DIR` and `UPLOAD_DIR` unset for the default persistent folders inside `crochet_ideas`. If you already use custom locations, preserve those values. Enable HTTPS for the domain through cPanel; the production admin cookie requires HTTPS.

Click **Save**, then **Restart**. The wrapper `app.cjs` loads the existing ES module server, including on Passenger versions that require a CommonJS startup file.

## 4. Open the site and create your admin account

- Website: https://abodabi.shop/
- Private studio: https://abodabi.shop/admin

On the first server run, open **cPanel → File Manager → crochet_ideas → .data → setup-token.txt**. Enable **Show Hidden Files** in File Manager settings if `.data` is hidden. Copy that server-generated code into the admin form and choose your email and password.

The hosting account has its own database. The code on GitHub deliberately excludes the local computer's database and setup code. If a server admin account already exists, sign in with it instead. Never publish the setup code on GitHub.

To transfer existing local content, stop the app and back up the server database first, then restore the intended database and uploaded images through a private transfer. Do not overwrite an established server database merely to update the source code.

## Future updates

1. Edit locally in VS Code and run `npm test`.
2. Commit and push to GitHub.
3. In cPanel, use **Update from Remote → Deploy HEAD Commit**.
4. Use **Restart** if needed, then check the site and `/admin`.

## Troubleshooting

- **Production startup fails:** ensure `SITE_URL=https://abodabi.shop` is present before restarting.
- **ES module / require error:** select `app.cjs` as the startup file.
- **Database module error:** ensure the selected Node runtime is 24.x.
- **Deploy button disabled:** verify the latest commit contains `.cpanel.yml` and the cPanel checkout has no uncommitted modifications.
- **Admin requests rejected / cannot stay signed in:** open the exact HTTPS host in `SITE_URL`. A `www` alias needs a redirect to that canonical host.
- **Old content still visible:** confirm the repository was pulled and deployed into `crochet_ideas`, then restart. Code deployments deliberately preserve the server database.

Official references: [Namecheap Node.js setup](https://www.namecheap.com/support/knowledgebase/article.aspx/10047/2182/how-to-work-with-nodejs-app/) and [cPanel Git deployment](https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-deployment/).
