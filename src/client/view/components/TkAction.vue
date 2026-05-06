<template>
  <div class="tk-action">
    <button class="tk-action-link" @click="onDelete" v-if="showDelete">
      <span class="tk-action-icon" v-html="iconDelete"></span>
      <span class="tk-action-icon tk-action-icon-solid" v-html="iconDeleteSolid"></span>
      <span class="tk-action-count"></span>
    </button>
    <button class="tk-action-link" :class="{ 'tk-liked': liked }" @click="onLike">
      <span class="tk-action-icon" v-html="iconLike"></span>
      <span class="tk-action-icon tk-action-icon-solid" v-html="iconLikeSolid"></span>
      <span class="tk-action-count">{{ likeCountStr }}</span>
    </button>
    <button class="tk-action-link" :class="{ 'tk-disliked': disliked }" @click="onDislike" v-if="showDislike">
      <span class="tk-action-icon" v-html="iconDislike"></span>
      <span class="tk-action-icon tk-action-icon-solid" v-html="iconDislikeSolid"></span>
      <span class="tk-action-count">{{ dislikeCountStr }}</span>
    </button>
    <button class="tk-action-link" @click="onReply">
      <span class="tk-action-icon" v-html="iconComment"></span>
      <span class="tk-action-icon tk-action-icon-solid" v-html="iconCommentSolid"></span>
      <span class="tk-action-count">{{ repliesCountStr }}</span>
    </button>
  </div>
</template>

<script>
import iconComment from '@fortawesome/fontawesome-free/svgs/regular/comment.svg'
import iconCommentSolid from '@fortawesome/fontawesome-free/svgs/solid/comment.svg'
import iconLike from '@fortawesome/fontawesome-free/svgs/regular/thumbs-up.svg'
import iconLikeSolid from '@fortawesome/fontawesome-free/svgs/solid/thumbs-up.svg'
import iconDislike from '@fortawesome/fontawesome-free/svgs/regular/thumbs-down.svg'
import iconDislikeSolid from '@fortawesome/fontawesome-free/svgs/solid/thumbs-down.svg'
import iconDelete from '@fortawesome/fontawesome-free/svgs/regular/trash-alt.svg'
import iconDeleteSolid from '@fortawesome/fontawesome-free/svgs/solid/trash-alt.svg'

export default {
  data () {
    return {
      iconComment,
      iconCommentSolid,
      iconLike,
      iconLikeSolid,
      iconDislike,
      iconDislikeSolid,
      iconDelete,
      iconDeleteSolid
    }
  },
  props: {
    liked: Boolean,
    disliked: Boolean,
    likeCount: Number,
    dislikeCount: Number,
    repliesCount: Number,
    showDislike: Boolean,
    showDelete: Boolean
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
    onLike () {
      this.$emit('like')
    },
    onDislike () {
      this.$emit('dislike')
    },
    onReply () {
      this.$emit('reply')
    },
    onDelete () {
      this.$emit('delete')
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
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  margin: 0;
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
