<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vitepress";

const envId = "https://twikoojsorg.imaegoo.com";
/**
 * 站点内嵌的 twikoo 客户端版本。
 *
 * **不写死版本号**：构建时由 `VITE_TWIKOO_VERSION` 注入（`.github/workflows/docs.yml` 在
 * release 触发时取发布 tag，push / 手动触发时取 registry 最新稳定版）。本地 `docs:dev`
 * 未设置该变量时回退 `latest`（jsDelivr 支持的版本标签）。
 */
const twikooVersion = import.meta.env.VITE_TWIKOO_VERSION || "latest";
/** twikoo 客户端 CDN 地址（版本见上） */
const twikooSrc = `https://cdn.jsdelivr.net/npm/twikoo@${twikooVersion}/dist/twikoo.min.js`;
const twikooJs = ref(null);
const router = useRouter();

function initTwikoo() {
  try {
    twikoo.init({
      envId,
      onCommentLoaded: initLightGallery,
    });
  } catch (e) {}
}

function initLightGallery() {
  var commentContents = [
    ...document.getElementsByClassName("vp-doc"),
    ...document.getElementsByClassName("tk-content"),
  ];
  for (var i = 0; i < commentContents.length; i++) {
    var commentItem = commentContents[i];
    var imgEls = commentItem.getElementsByTagName("img");
    if (imgEls.length > 0) {
      for (var j = 0; j < imgEls.length; j++) {
        var imgEl = imgEls[j];
        if (imgEl.parentElement.tagName === "A") continue;
        var aEl = document.createElement("a");
        aEl.setAttribute("class", "tk-lg-link");
        aEl.setAttribute("href", imgEl.getAttribute("src"));
        aEl.setAttribute("data-src", imgEl.getAttribute("src"));
        aEl.appendChild(imgEl.cloneNode(false));
        imgEl.parentNode.insertBefore(aEl, imgEl.nextSibling);
        imgEl.remove();
      }
      lightGallery(commentItem, {
        selector: ".tk-lg-link",
        share: false,
      });
    }
  }
}

function initJs() {
  if (twikooJs.value) {
    twikooJs.value.onload = initTwikoo;
    router.onAfterRouteChanged = onRoute;
  }
}

function onRoute(to) {
  if (to) setTimeout(initTwikoo, 1000);
}

onMounted(() => {
  initTwikoo();
  initJs();
});
</script>

<template>
  <div class="comment-container vp-raw">
    <!-- KaTeX -->
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.css"
      integrity="sha384-AfEj0r4/OFrOo5t7NnNe46zW/tFgW6x/bCJG8FqQCEo3+Aro6EYUG4+cU+KJWu/X"
      crossorigin="anonymous"
    />
    <component
      :is="'script'"
      defer
      src="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.js"
      integrity="sha384-g7c+Jr9ZivxKLnZTDUhnkOnsh30B4H0rpLUpJ4jAIKs4fnJI+sEnkvrMWph2EDg4"
      crossorigin="anonymous"
    ></component>
    <component
      :is="'script'"
      defer
      src="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/contrib/auto-render.min.js"
      integrity="sha384-mll67QQFJfxn0IYznZYonOWZ644AWYC+Pt2cHqMaRhXVrursRwvLnLaebdGIlYNa"
      crossorigin="anonymous"
    ></component>

    <!-- lightGallery -->
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/lightgallery@2.1.8/css/lightgallery.css"
      integrity="sha384-U8ohOXEVyF0NGY2LQnH83V4wGxOmFhim4U5xhfE/WDCHdPO2iUKPPYkhpDl9U/Yf"
      crossorigin="anonymous"
    />
    <component
      :is="'script'"
      src="https://cdn.jsdelivr.net/npm/lightgallery@2.1.8/lightgallery.min.js"
      integrity="sha384-l5lFB9srHFAyvfCoHya9X1JwGGTNPvDtikieqZp7qu/bomCw0e0+yoyiL0f7UXLD"
      crossorigin="anonymous"
    ></component>

    <!-- Twikoo -->
    <div id="twikoo"></div>
    <component :is="'script'" :src="twikooSrc" crossorigin="anonymous" ref="twikooJs"></component>
  </div>
</template>
