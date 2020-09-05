<template>
  <div class="tk-avatar" :class="{ 'tk-clickable': !!link }" @click="onClick">
    <div class="tk-avatar-img" v-if="!avatar" v-html="iconUser"></div>
    <img class="tk-avatar-img" v-if="avatar" :src="avatar" alt="avatar">
  </div>
</template>

<script>
import md5 from 'blueimp-md5'
import iconUser from '@fortawesome/fontawesome-free/svgs/solid/user-circle.svg'

export default {
  props: {
    mail: String,
    mailMd5: String,
    link: String
  },
  data () {
    return {
      iconUser
    }
  },
  computed: {
    avatar () {
      if (this.mailMd5) {
        return `https://gravatar.loli.net/avatar/${this.mailMd5}`
      } else if (this.mail) {
        return `https://gravatar.loli.net/avatar/${md5(this.mail)}`
      } else {
        return ''
      }
    }
  },
  methods: {
    onClick () {
      this.$emit('click')
      this.link && window.open(this.link)
    }
  }
}
</script>

<style scoped>
.tk-avatar {
  flex-shrink: 0;
  height: 2.5rem;
  width: 2.5rem;
  overflow: hidden;
  text-align: center;
  border-radius: 5px;
}
.tk-avatar.tk-clickable {
  cursor: pointer;
}
.tk-avatar .tk-avatar-img {
  height: 2.5rem;
}
.tk-avatar .tk-avatar-img /deep/ svg {
  fill: #c0c4cc;
}
</style>
