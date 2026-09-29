# Update

The update procedure depends on how Twikoo was deployed. After updating the backend, remember to update the `x.x.x` version number in the frontend CDN URL so that both sides match, then redeploy your site.

## CloudBase, one-click deployment

Open 环境 → 我的应用 in the CloudBase console and enter:

- Source: `https://github.com/twikoojs/twikoo/tree/main`
- Branch: `main`

Leave the application directory empty and confirm; the deployment runs automatically.

::: tip No version number to change
The one-click deployment depends on `twikoo-func@latest` (see [`templates/cloudbase/twikoo/package.json`](https://github.com/twikoojs/twikoo/blob/main/templates/cloudbase/twikoo/package.json)), so a single redeploy picks up the newest stable release.

If the version does not change after redeploying, open 环境 → 云函数，open `package.json` and click **保存并安装依赖** once to force a fresh install.
:::

## CloudBase, manual deployment

Open 环境 → 云函数 in the CloudBase console, click the `twikoo` function, open the code editor, check that `package.json` depends on `"twikoo-func": "latest"` (1.x pinned an exact version here — switching it to `latest` means you never have to edit it again), then click **保存并安装依赖** (save and install dependencies).

::: tip
If your function is older than 1.0.0, recreate it following the manual deployment guide first (the deployment steps changed in 1.0.0).

If the comment list stops loading after an upgrade, delete the `node_modules` directory in the function editor (this takes about 30 seconds), then save and install dependencies again. If that does not help, delete and recreate the Twikoo function.
:::

::: warning Runtime version
On CloudBase, upgrade the function runtime to **Node 20 or newer (24 recommended)**. The 2.0 build targets ES2022 and no longer supports Node 16.13.
:::

## CloudBase, command line deployment

::: danger Removed in 2.0
Twikoo 2.0 removes command line deployment (`tcb fn deploy` and the `yarn deploy` / `login` / `logout` scripts). Use the console procedure above instead. The command below is kept for 1.x reference only.
:::

```sh
yarn deploy -e your-env-id
```

## Vercel

::: tip No version number to change
The one-click deployment depends on `twikoo-vercel@latest` (see [`templates/vercel-min/package.json`](https://github.com/twikoojs/twikoo/blob/main/templates/vercel-min/package.json)), so a redeploy picks up the newest stable release.

Vercel reuses the build cache by default, and a cache hit means `latest` is not re-resolved — **clear the "Use existing Build Cache" checkbox when redeploying**, otherwise the old dependency is kept.
:::

1. Open the [Vercel dashboard](https://vercel.com/dashboard) → twikoo → Deployments.
2. Open the menu (three dots) of the latest deployment → Redeploy.
3. Uncheck **Use existing Build Cache** and confirm.
4. Once deployed, open your domain: if the environment is configured correctly you should see "Twikoo 云函数运行正常".

## Railway

The template repository [`twikoojs/twikoo-zeabur`](https://github.com/twikoojs/twikoo-zeabur) depends on `tkserver@latest`, so **there is no version number to change**.

1. On GitHub, open the `twikoo-zeabur` repository you forked and click **Sync fork**.
2. The deployment is triggered automatically; if it is not, or the version does not change, redeploy manually from the Railway dashboard.

::: tip If your fork pins an exact version
Change `"tkserver": "x.x.x"` to `"tkserver": "latest"` in `package.json` — from then on you only need to sync the fork and redeploy.
:::

## Netlify

::: warning Breaking upgrade: Modern Netlify Functions
The new Netlify template switches the function entry from the legacy CommonJS
`exports.handler` form to a Modern Netlify Functions ESM default export. This enables
`context.waitUntil()` for asynchronous `POST_SUBMIT` dispatch so mail and other
post-submit notifications no longer block the comment response.

This upgrade changes the **npm dependency, function entry, and Node.js runtime together**:

- Updating only `twikoo-netlify` while keeping the old `require(...).handler` entry still works, but it stays on the synchronous compatibility path and may still wait up to about 5 seconds.
- Updating only the template while an old `twikoo-netlify` package is installed may fail during build or function loading because the Modern default entry is unavailable.
- Node 18/20 is no longer sufficient for the Modern entry; Node.js **>= 22.12.0** is required.
- Syncing an old fork may conflict because `twikoo.js` is removed and replaced by `twikoo.mjs`. If that happens, apply the steps below manually.
:::

For an existing Netlify deployment created from the old template:

1. Open your forked `twikoo-netlify` repository on GitHub and click **Sync fork**. If GitHub reports a conflict, apply the following changes manually.
2. Delete:

   ```text
   netlify/functions/twikoo.js
   ```

   Create:

   ```text
   netlify/functions/twikoo.mjs
   ```

   with:

   ```js
   export { default } from "twikoo-netlify"
   ```

3. Make sure `package.json` contains at least:

   ```json
   {
     "dependencies": {
       "twikoo-netlify": "latest"
     },
     "engines": {
       "node": ">=22.12.0"
     }
   }
   ```

4. Create or update `.node-version` in the repository root:

   ```text
   24
   ```

   If your Netlify project explicitly sets `NODE_VERSION`, make sure it is at least 22.12.0; Node 24 is recommended.

5. Commit and push the changes.
6. In Netlify, go to **Deploys → Trigger deploy → Clear cache and deploy site** so `latest` is resolved and installed again.
7. Open the function URL and verify that it reports Twikoo is running normally.
8. Submit a test comment and confirm that the response returns quickly while email / push notifications are still delivered.

::: tip Future upgrades
After this one-time entry migration, future upgrades only require syncing the template and redeploying.
If the dependency remains `"twikoo-netlify": "latest"`, you do not need to edit a version number manually.
:::

## Hugging Face

> Applies to all Docker Spaces. Since July 2026 free accounts can no longer create new ones — see the prerequisite note in the [deployment guide](/backend#hugging-face-部署).

1. Open your Space, click **Settings** in the top bar, scroll down and click **Factory rebuild**.

## Self-hosted (Node)

1. Stop the old version: `kill $(ps -ef | grep tkserver | grep -v 'grep' | awk '{print $2}')`
2. Install the new version: `npm i -g tkserver@latest`
3. Start it again: `nohup tkserver >> tkserver.log 2>&1 &`

## Self-hosted (Docker)

1. Pull the new image: `docker pull imaegoo/twikoo`
2. Stop the old container: `docker stop twikoo`
3. Remove the old container: `docker rm twikoo`
4. Start a new container (see the self-hosted Docker guide in the Chinese documentation).

## Automatic updates

For availability and security reasons Twikoo does not implement automatic updates, and there is no plan to do so. If you want automatic updates, see [twikoo-update](https://github.com/MHuiG/twikoo-update) by MHuiG, which is built on GitHub workflows.
