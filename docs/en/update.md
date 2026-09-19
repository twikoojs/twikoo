# Update

The update procedure depends on how Twikoo was deployed. After updating the backend, remember to update the `x.x.x` version number in the frontend CDN URL so that both sides match, then redeploy your site.

## CloudBase, one-click deployment

Open 环境 → 我的应用 in the CloudBase console and enter:

- Source: `https://github.com/twikoojs/twikoo/tree/main`
- Branch: `main`

Leave the application directory empty and confirm; the deployment runs automatically.

## CloudBase, manual deployment

Open 环境 → 云函数 in the CloudBase console, click the `twikoo` function, open the code editor, edit `package.json`, change the version of `"twikoo-func"` to the latest release, then click **保存并安装依赖** (save and install dependencies).

::: tip
If your function is older than 1.0.0, recreate it following the manual deployment guide first (the deployment steps changed in 1.0.0).

If the comment list stops loading after an upgrade, delete the `node_modules` directory in the function editor (this takes about 30 seconds), then save and install dependencies again. If that does not help, delete and recreate the Twikoo function.
:::

## CloudBase, command line deployment

::: danger Removed in 2.0
Twikoo 2.0 removes command line deployment (`tcb fn deploy` and the `yarn deploy` / `login` / `logout` scripts). Use the console procedure above instead. The command below is kept for 1.x reference only.
:::

```sh
yarn deploy -e your-env-id
```

## Vercel

1. Open the [Vercel dashboard](https://vercel.com/dashboard) → twikoo → Settings → Git.
2. Click the repository link under **Connected Git Repository**.
3. Open `package.json` and edit it.
4. Change `"twikoo-vercel": "latest"` to the latest version number, then commit the change.
5. The deployment is triggered automatically; check its status in the [Vercel dashboard](https://vercel.com/dashboard).

## Railway and Zeabur

1. On GitHub, open the `twikoo-zeabur` repository you forked.
2. Edit `package.json`.
3. Change `"tkserver": "latest"` to the latest version number and commit.
4. The deployment is triggered automatically.

## Netlify

1. On GitHub, open the `twikoo-netlify` repository you forked.
2. Edit `package.json`. Because `twikoo-netlify` reuses the `twikoo-vercel` implementation, update both versions (replace `new version` with the latest release):

```json
{
  "dependencies": {
    "twikoo-netlify": "new version",
    "twikoo-vercel": "new version"
  }
}
```

3. Commit the change.
4. The deployment is triggered automatically.

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
