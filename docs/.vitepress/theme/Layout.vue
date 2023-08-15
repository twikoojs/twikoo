<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

const { Layout } = DefaultTheme
const envId = 'https://twikoojsorg.imaegoo.com'
const twikooJs = ref(null)
const router = useRouter()

function initTwikoo () {
  try {
    twikoo.init({
      envId,
      onCommentLoaded: initLightGallery
    })
  } catch (e) {}
}

function initLightGallery () {
  // This function is compiled to ES5
  var commentContents = document.getElementsByClassName('tk-content');
  for (var i = 0; i < commentContents.length; i++) {
    var commentItem = commentContents[i];
    var imgEls = commentItem.getElementsByTagName('img');
    if (imgEls.length > 0) {
      for (var j = 0; j < imgEls.length; j++) {
        var imgEl = imgEls[j];
        var aEl = document.createElement('a');
        aEl.setAttribute('class', 'tk-lg-link');
        aEl.setAttribute('href', imgEl.getAttribute('src'));
        aEl.setAttribute('data-src', imgEl.getAttribute('src'));
        aEl.appendChild(imgEl.cloneNode(false));
        imgEl.parentNode.insertBefore(aEl, imgEl.nextSibling);
        imgEl.remove();
      }
      lightGallery(commentItem, {
        selector: '.tk-lg-link',
        share: false
      })
    }
  }
}

function initJs () {
  if (twikooJs.value) {
    twikooJs.value.onload = initTwikoo
    router.onAfterRouteChanged = onRoute
  }
}

function onRoute (to) {
  if (to) setTimeout(initTwikoo, 1000)
}

onMounted(() => {
  initTwikoo()
  initJs()
})
</script>

<template>
  <Layout>
    <template #doc-after>
      <div class="comment-container">
        <!-- KaTeX -->
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.css" integrity="sha384-AfEj0r4/OFrOo5t7NnNe46zW/tFgW6x/bCJG8FqQCEo3+Aro6EYUG4+cU+KJWu/X" crossorigin="anonymous">
        <component :is="'script'" defer src="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.js" integrity="sha384-g7c+Jr9ZivxKLnZTDUhnkOnsh30B4H0rpLUpJ4jAIKs4fnJI+sEnkvrMWph2EDg4" crossorigin="anonymous"></component>
        <component :is="'script'" defer src="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/contrib/auto-render.min.js" integrity="sha384-mll67QQFJfxn0IYznZYonOWZ644AWYC+Pt2cHqMaRhXVrursRwvLnLaebdGIlYNa" crossorigin="anonymous"></component>

        <!-- lightGallery -->
        <link rel="stylesheet" href="https://cdn.staticfile.org/lightgallery/2.1.8/css/lightgallery.css">
        <component :is="'script'" src="https://cdn.staticfile.org/lightgallery/2.1.8/lightgallery.min.js"></component>

        <!-- Twikoo -->
        <div id="twikoo"></div>
        <component :is="'script'" src="https://cdn.jsdelivr.net/npm/twikoo@1.6.17/dist/twikoo.all.min.js" ref="twikooJs"></component>
      </div>
    </template>
  </Layout>
</template>
