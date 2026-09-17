# Frontend deployment

Twikoo has two parts: the serverless backend and the frontend. Deploy both, and **keep their versions in sync** (see [Update](/en/update)).

- If your site theme already supports Twikoo, just point the theme configuration at your backend (`envId` for CloudBase, or the deployment URL for Vercel / Netlify / self-hosted).
- Otherwise include the Twikoo bundle manually, as shown below.

> Theme-specific integration guides (Hexo / Hugo / WordPress …) with screenshots are maintained in the Chinese documentation: [前端部署](/frontend).

## Include via CDN

```html
<div id="tcomment"></div>
<script src="https://cdn.jsdelivr.net/npm/twikoo@2.0.0-beta.1/dist/twikoo.min.js"></script>
<script>
  twikoo.init({
    envId: "your envId", // CloudBase: envId; Vercel / Netlify / self-hosted: the deployment URL
    el: "#tcomment", // container element
    // region: 'ap-guangzhou', // CloudBase region, defaults to ap-shanghai
    // path: location.pathname, // custom JS path used to distinguish articles
    // lang: 'en', // set the comment area language manually
  });
</script>
```

### Bundle variants

- `twikoo.all.min.js`: full bundle including the Tencent CloudBase SDK — use it when Twikoo is deployed on CloudBase.
- `twikoo.min.js`: smaller bundle without the CloudBase SDK — for every other deployment platform.
- `twikoo.nocss.js`: the full bundle with styles stripped; include `twikoo.css` separately. For users who want to restyle the comment area.

### CDN mirrors

If the default CDN is slow in your region, pick another mirror. Some mirrors need a few days to pick up a new release.

Recommended in mainland China:

- `https://registry.npmmirror.com/twikoo/2.0.0-beta.1/files/dist/twikoo.min.js`
- `https://s4.zstatic.net/npm/twikoo@2.0.0-beta.1/dist/twikoo.min.js`

Recommended worldwide:

- `https://cdn.jsdelivr.net/npm/twikoo@2.0.0-beta.1/dist/twikoo.min.js`

::: warning
Pin the version in the URL so that a future Twikoo release cannot break your site with an incompatible change.
:::

::: tip Browser baseline (BC-2)
The 2.0 frontend targets **ES2022** and no longer supports IE / ES5. Minimum versions: Chrome 94+, Edge 94+, Firefox 93+, Safari 15.4+, iOS Safari 15.4+.
:::
