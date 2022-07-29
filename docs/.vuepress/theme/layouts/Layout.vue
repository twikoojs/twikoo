<template>
  <ParentLayout>
    <template #page-bottom>
      <div class="page-nav">
        <!-- KaTeX -->
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.css" integrity="sha384-AfEj0r4/OFrOo5t7NnNe46zW/tFgW6x/bCJG8FqQCEo3+Aro6EYUG4+cU+KJWu/X" crossorigin="anonymous">
        <component :is="'script'" defer src="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.js" integrity="sha384-g7c+Jr9ZivxKLnZTDUhnkOnsh30B4H0rpLUpJ4jAIKs4fnJI+sEnkvrMWph2EDg4" crossorigin="anonymous"></component>
        <component :is="'script'" defer src="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/contrib/auto-render.min.js" integrity="sha384-mll67QQFJfxn0IYznZYonOWZ644AWYC+Pt2cHqMaRhXVrursRwvLnLaebdGIlYNa" crossorigin="anonymous"></component>

        <!-- lightGallery -->
        <link rel="stylesheet" href="https://cdn.staticfile.org/lightgallery/2.1.8/css/lightgallery.css">
        <component :is="'script'" src="https://cdn.staticfile.org/lightgallery/2.1.8/lightgallery.min.js"></component>

        <!-- Twikoo -->
        <div id="twikoo"></div>
        <component :is="'script'" src="https://cdn.staticfile.org/twikoo/1.6.0-beta.1/twikoo.all.min.js" ref="twikooJs"></component>
      </div>
    </template>
  </ParentLayout>
</template>

<script>
import ParentLayout from '@vuepress/theme-default/lib/client/layouts/Layout.vue'

const envId = 'https://twikoo.vercel.app'

export default {
  name: 'Layout',
  components: {
    ParentLayout
  },
  mounted () {
    this.initTwikoo()
    this.initJs()
  },
  methods: {
    initTwikoo () {
      try {
        twikoo.init({
          envId,
          onCommentLoaded: this.initLightGallery
        })
      } catch (e) {}
    },
    initLightGallery () {
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
    },
    initJs () {
      const twikooJs = this.$refs.twikooJs
      if (twikooJs) {
        twikooJs.onload = this.initTwikoo
        this.$router.afterEach(this.onRoute)
      }
    },
    onRoute (to, from) {
      if (to.path !== from.path) setTimeout(this.initTwikoo, 1000)
    }
  }
}
</script>
