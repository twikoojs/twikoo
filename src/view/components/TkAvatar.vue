<template>
  <div class="tk-avatar" :class="{ 'tk-clickable': !!link, 'tk-has-avatar': !!avatarInner }" @click="onClick">
    <div class="tk-avatar-img" v-if="!avatarInner" v-html="iconUser"></div>
    <img class="tk-avatar-img" v-if="avatarInner" :src="avatarInner" alt="">
  </div>
</template>

<script>
import md5 from 'blueimp-md5'
import { convertLink, isQQ, getQQAvatar } from '../../js/utils'
import iconUser from '@fortawesome/fontawesome-free/svgs/solid/user-circle.svg'

export default {
  props: {
    config: Object,
    avatar: String,
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
    gravatarCdn () {
      if (this.config && this.config.GRAVATAR_CDN) {
        return this.config.GRAVATAR_CDN
      } else {
        return 'cn.gravatar.com'
      }
    },
    avatarInner () {
      if (this.avatar) {
        return this.avatar
      } else if (this.mailMd5) {
        return `https://${this.gravatarCdn}/avatar/${this.mailMd5}?d=identicon`
      } else if (this.mail && isQQ(this.mail)) {
        return getQQAvatar(this.mail)
      } else if (this.mail) {
        return `https://${this.gravatarCdn}/avatar/${md5(this.mail)}?d=identicon`
      } else {
        return ''
      }
    }
  },
  methods: {
    onClick () {
      this.$emit('click')
      this.link && window.open(convertLink(this.link))
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
.tk-avatar.tk-has-avatar {
  background-color: #90939920;
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
