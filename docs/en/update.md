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

## Railway and Zeabur

The template repository [`twikoojs/twikoo-zeabur`](https://github.com/twikoojs/twikoo-zeabur) depends on `tkserver@latest`, so **there is no version number to change**.

1. On GitHub, open the `twikoo-zeabur` repository you forked and click **Sync fork**.
2. The deployment is triggered automatically; if it is not, or the version does not change, redeploy manually from the Railway / Zeabur dashboard.

::: tip If your fork pins an exact version
Change `"tkserver": "x.x.x"` to `"tkserver": "latest"` in `package.json` — from then on you only need to sync the fork and redeploy.
:::

## Netlify

1. On GitHub, open the `twikoo-netlify` repository you forked.
2. Check that `package.json` depends on `latest` (change it to the following if not):

```json
{
  "dependencies": {
    "twikoo-netlify": "latest"
  }
}
```

::: tip Only one dependency since 2.0
1.x's `twikoo-netlify` reused the `twikoo-vercel` implementation, so both had to be listed. Since 2.0 they are independent implementations — `twikoo-netlify` alone is enough.
:::

3. Click **Sync fork**, then in the Netlify dashboard go to Deploys → Trigger deploy → **Clear cache and deploy site** (clearing the cache is what makes `latest` resolve again).
4. The deployment runs automatically.

## Hugging Face

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
