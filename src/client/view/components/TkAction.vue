<template>
  <div class="tk-action">
    <a class="tk-action-link" :class="{ 'tk-liked': liked }" href="#" @click="onLike">
      <span class="tk-action-icon" v-html="iconLike"></span>
      <span class="tk-action-icon tk-action-icon-solid" v-html="iconLikeSolid"></span>
      <span class="tk-action-count">{{ likeCountStr }}</span>
    </a>
    <a class="tk-action-link" :class="{ 'tk-disliked': disliked }" href="#" @click="onDislike">
      <span class="tk-action-icon" v-html="iconDislike"></span>
      <span class="tk-action-icon tk-action-icon-solid" v-html="iconDislikeSolid"></span>
      <span class="tk-action-count">{{ dislikeCountStr }}</span>
    </a>
    <a class="tk-action-link" href="#" @click="onReply">
      <span class="tk-action-icon" v-html="iconComment"></span>
      <span class="tk-action-icon tk-action-icon-solid" v-html="iconCommentSolid"></span>
      <span class="tk-action-count">{{ repliesCountStr }}</span>
    </a>
  </div>
</template>

<script>
import iconComment from '@fortawesome/fontawesome-free/svgs/regular/comment.svg'
import iconCommentSolid from '@fortawesome/fontawesome-free/svgs/solid/comment.svg'
import iconLike from '@fortawesome/fontawesome-free/svgs/regular/thumbs-up.svg'
import iconLikeSolid from '@fortawesome/fontawesome-free/svgs/solid/thumbs-up.svg'
import iconDislike from '@fortawesome/fontawesome-free/svgs/regular/thumbs-down.svg'
import iconDislikeSolid from '@fortawesome/fontawesome-free/svgs/solid/thumbs-down.svg'

export default {
  data () {
    return {
      iconComment,
      iconCommentSolid,
      iconLike,
      iconLikeSolid,
      iconDislike,
      iconDislikeSolid
    }
  },
  props: {
    liked: Boolean,
    disliked: Boolean,
    likeCount: Number,
    dislikeCount: Number,
    repliesCount: Number
  },
  computed: {
    likeCountStr () {
      return this.likeCount > 0 ? `${this.likeCount}` : ''
    },
    dislikeCountStr () {
      return this.dislikeCount > 0 ? `${this.dislikeCount}` : ''
    },
    repliesCountStr () {
      return this.repliesCount > 0 ? `${this.repliesCount}` : ''
    }
  },
  methods: {
    onLike ($event) {
      $event.preventDefault()
      this.$emit('like')
    },
    onDislike ($event) {
      $event.preventDefault()
      this.$emit('dislike')
    },
    onReply ($event) {
      $event.preventDefault()
      this.$emit('reply')
    }
  }
}
</script>

<style>
.tk-action {
  display: flex;
  align-items: center;
}
.tk-action-link {
  margin-left: 0.5rem;
  color: #409eff;
  text-decoration: none;
  display: flex;
  align-items: center;
}
.tk-action-link .tk-action-icon-solid {
  display: none;
}
.tk-action-link.tk-liked .tk-action-icon,
.tk-action-link:hover .tk-action-icon {
  display: none;
}
.tk-action-link.tk-liked .tk-action-icon-solid,
.tk-action-link:hover .tk-action-icon-solid {
  display: block;
}
.tk-action-link.tk-disliked .tk-action-icon,
.tk-action-link.tk-disliked:hover .tk-action-icon {
  display: none;
}
.tk-action-link.tk-disliked .tk-action-icon-solid,
.tk-action-link.tk-disliked:hover .tk-action-icon-solid {
  display: block;
}
.tk-action-count {
  margin-left: 0.25rem;
  font-size: 0.75rem;
  height: 1.5rem;
  line-height: 1.5rem;
}
.tk-action-icon {
  display: inline-block;
  height: 1em;
  width: 1em;
  line-height: 0;
  color: #409eff;
}
</style>
