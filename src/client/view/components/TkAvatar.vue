<template>
  <div class="tk-avatar" :class="{ 'tk-clickable': !!link, 'tk-has-avatar': !!avatarInner }" @click="onClick">
    <div class="tk-avatar-img" v-if="!avatarInner" v-html="iconUser"></div>
    <img class="tk-avatar-img" v-if="avatarInner" :src="avatarInner" alt="">
  </div>
</template>

<script>
import md5 from 'blueimp-md5'
import { sha256 } from 'js-sha256'
import { convertLink, normalizeMail, isQQ, getQQAvatar } from '../../utils'
import iconUser from '@fortawesome/fontawesome-free/svgs/solid/user-circle.svg'

export default {
  props: {
    config: Object,
    avatar: String,
    nick: String,
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
      }
      return 'weavatar.com'
    },
    defaultGravatar () {
      if (this.config && this.config.DEFAULT_GRAVATAR) {
        return this.config.DEFAULT_GRAVATAR
      }
      return `initials&name=${this.nick}`
    },
    avatarInner () {
      if (this.avatar) {
        return this.avatar
      }
      if (this.mailMd5) {
        return `https://${this.gravatarCdn}/avatar/${this.mailMd5}?d=${this.defaultGravatar}`
      }
      if (this.mail && isQQ(this.mail)) {
        return getQQAvatar(this.mail)
      }
      if (this.mail) {
        const hashMethod = this.gravatarCdn === 'cravatar.cn' ? md5 : sha256
        return `https://${this.gravatarCdn}/avatar/${hashMethod(normalizeMail(this.mail))}?d=${this.defaultGravatar}`
      }
      return ''
    }
  },
  methods: {
    onClick () {
      this.$emit('click')
      if (this.link) {
        window.open(convertLink(this.link), '_blank').opener = null
      }
    }
  }
}
</script>

<style>
.tk-avatar {
  flex-shrink: 0;
  height: 2.5rem;
  width: 2.5rem;
  overflow: hidden;
  text-align: center;
  border-radius: 5px;
  margin-right: 1rem;
}
.tk-comment .tk-submit .tk-avatar,
.tk-replies .tk-avatar {
  height: 1.6rem;
  width: 1.6rem;
}
.tk-avatar.tk-has-avatar {
  background-color: rgba(144,147,153,0.13);
}
.tk-avatar.tk-clickable {
  cursor: pointer;
}
.tk-avatar .tk-avatar-img {
  height: 2.5rem;
  color: #c0c4cc;
}
.tk-comment .tk-submit .tk-avatar .tk-avatar-img,
.tk-replies .tk-avatar .tk-avatar-img {
  height: 1.6rem;
}
</style>
