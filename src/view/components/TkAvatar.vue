<template>
  <div class="tk-avatar" @click="onClick">
    <el-tooltip v-if="!readonly" class="item" effect="dark" placement="bottom-start" v-model="showMetaInput" manual>
      <div class="tk-avatar-placeholder">
        <img v-if="avatar" :src="avatar" alt="">
      </div>
      <template v-slot:content>
        <input class="tk-meta-input" v-model="metaData.nick" placeholder="昵称" @blur="updateMeta" />
        <input class="tk-meta-input" v-model="metaData.mail" placeholder="邮箱" @blur="updateMeta" />
        <input class="tk-meta-input" v-model="metaData.site" placeholder="网址" @blur="updateMeta" />
      </template>
    </el-tooltip>
    <el-tooltip v-if="readonly" class="item" effect="dark" placement="bottom-start" :content="nick || '匿名'">
      <div class="tk-avatar-placeholder">
        <img v-if="avatar" :src="avatar" alt="">
      </div>
    </el-tooltip>
  </div>
</template>

<script>
import md5 from 'blueimp-md5'

export default {
  props: {
    nick: String,
    mail: String,
    site: String,
    readonly: Boolean
  },
  data () {
    return {
      metaData: {
        nick: '',
        mail: '',
        site: ''
      },
      avatar: '',
      showMetaInput: false
    }
  },
  methods: {
    initMeta () {
      if (localStorage.getItem('twikoo')) {
        this.metaData = JSON.parse(localStorage.getItem('twikoo'))
      }
      this.updateMeta()
    },
    updateMeta () {
      localStorage.setItem('twikoo', JSON.stringify(this.metaData))
      this.$emit('update', this.metaData)
    },
    updateAvatar () {
      if (this.mail) {
        this.avatar = `https://gravatar.loli.net/avatar/${md5(this.mail)}`
      } else {
        this.avatar = ''
      }
    },
    onClick () {
      this.$emit('click')
      if (this.readonly) {
        this.site && window.open(this.site)
      } else {
        this.showMetaInput = !this.showMetaInput
      }
    }
  },
  watch: {
    nick (newVal) { this.metaData.nick = newVal },
    mail (newVal) {
      this.metaData.mail = newVal
      this.updateAvatar()
    },
    site (newVal) { this.metaData.site = newVal }
  },
  mounted () {
    if (this.readonly) {
      this.updateAvatar()
    } else {
      this.initMeta()
    }
  }
}
</script>

<style scoped>
.tk-avatar {
  background-image: url(data:image/png;base64,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);
  background-size: contain;
  cursor: pointer;
  height: 2rem;
  width: 2rem;
  overflow: hidden;
  text-align: center;
}
.tk-avatar-placeholder {
  height: 2rem;
  width: 2rem;
}
.tk-avatar img {
  height: 2rem;
}
.tk-meta-input {
  color: white;
  border: none;
  border-bottom: 1px solid grey;
  background: none;
}
.tk-meta-input:focus {
  border-bottom-color: white;
}
</style>

<style>
.el-fade-in-linear-enter-active,
.el-fade-in-linear-leave-active {
  transition: opacity 200ms linear;
}
.el-fade-in-linear-enter,
.el-fade-in-linear-leave,
.el-fade-in-linear-leave-active {
  opacity: 0;
}
</style>
