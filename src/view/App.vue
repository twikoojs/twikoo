<template>
  <div id="twikoo" class="twikoo">
    <tk-new-post @update="initPost" />
    <tk-post v-for="post in posts"
        :id="post._id"
        :key="post._id"
        :post="post" />
  </div>
</template>

<script>
import TkNewPost from './components/TkNewPost.vue'
import TkPost from './components/TkPost.vue'

export default {
  components: {
    TkNewPost,
    TkPost
  },
  data () {
    return {
      posts: []
    }
  },
  methods: {
    async initPost () {
      const posts = await this.$tcb.db
        .collection('post')
        .orderBy('updated', 'desc')
        .limit(10)
        .get()
      this.posts = posts.data
    }
  },
  async mounted () {
    if (this.$tcb && this.$tcb.db) {
      await this.initPost()
    }
  }
}
</script>

<style>
.tk-post {
  margin-top: 1rem;
}
</style>
