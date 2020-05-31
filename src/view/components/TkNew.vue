<template>
  <div class="tk-new">
    <tk-avatar :nick="nick" :mail="mail" :site="site" @update="onMetaUpdate" />
    <el-input class="tk-input"
        type="textarea"
        autosize
        placeholder="请输入内容"
        v-model="content" />
    <el-tooltip class="item" effect="dark" placement="bottom" :content="disableTooltip">
      <el-button class="tk-send"
          type="primary"
          size="small"
          :disabled="!canSend"
          @click="send">发送</el-button>
    </el-tooltip>
  </div>
</template>

<script>
import TkAvatar from './TkAvatar.vue'

export default {
  components: {
    TkAvatar
  },
  props: {
    isSending: Boolean
  },
  data () {
    return {
      content: '',
      nick: '',
      mail: '',
      site: ''
    }
  },
  computed: {
    canSend () {
      return !this.isSending
          && !!this.nick
          && !!this.mail
          && !!this.content
    },
    disableTooltip () {
      if (this.isSending) return '发送中'
      else if (!this.nick) return '请填写昵称'
      else if (!this.mail) return '请填写邮箱'
      else if (!this.content) return '请填写内容'
    }
  },
  methods: {
    onMetaUpdate (metaData) {
      this.nick = metaData.nick
      this.mail = metaData.mail
      this.site = metaData.site
    },
    send () {
      this.$emit('send', {
        nick: this.nick,
        mail: this.mail,
        site: this.site,
        master: this.mail === this.$twikoo.masterMail,
        content: this.content
      })
    },
    onSendComplete () {
      this.content = ''
    }
  },
  watch: {
    isSending (newVal, oldVal) {
      if (newVal === false && oldVal === true) {
        this.onSendComplete()
      }
    }
  }
}
</script>

<style scoped>
.tk-new {
  display: flex;
  flex-direction: row;
}
.tk-avatar {
  margin-right: 1rem;
}
.tk-input {
  flex: 1;
}
.tk-send {
  margin-left: 1rem;
}
</style>
