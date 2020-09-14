<template>
  <div class="tk-meta-input">
    <el-input v-for="metaInput in metaInputs"
        :key="metaInput.key"
        :placeholder="metaInput.placeholder"
        v-model="metaData[metaInput.key]"
        size="small"
        @change="onMetaChange">
      <template slot="prepend">{{ metaInput.locale }}</template>
    </el-input>
  </div>
</template>

<script>
const metaInputs = [
  { key: 'nick', locale: '昵称', placeholder: '必填' },
  { key: 'mail', locale: '邮箱', placeholder: '必填' },
  { key: 'link', locale: '网址', placeholder: '选填' }
]

export default {
  props: {
    nick: String,
    mail: String,
    link: String
  },
  data () {
    return {
      metaInputs,
      metaData: {
        nick: '',
        mail: '',
        link: ''
      }
    }
  },
  methods: {
    initMeta () {
      if (localStorage.getItem('twikoo')) {
        const metaData = JSON.parse(localStorage.getItem('twikoo'))
        this.metaData.nick = metaData.nick
        this.metaData.mail = metaData.mail
        this.metaData.link = metaData.link
      }
      this.updateMeta()
    },
    updateMeta () {
      localStorage.setItem('twikoo', JSON.stringify(this.metaData))
      this.$emit('update', this.metaData)
    },
    onMetaChange () {
      this.updateMeta()
    }
  },
  watch: {
    nick (newVal) { this.metaData.nick = newVal },
    mail (newVal) { this.metaData.mail = newVal },
    link (newVal) { this.metaData.link = newVal }
  },
  mounted () {
    this.initMeta()
  }
}
</script>

<style scoped>
.tk-meta-input {
  display: flex;
}
.tk-meta-input .el-input {
  width: auto;
  width: calc((100% - 1rem) / 3); /* Fix Safari */
  flex: 1;
}
.tk-meta-input .el-input + .el-input {
  margin-left: 0.5rem;
}
.tk-meta-input .el-input /deep/ .el-input-group__prepend {
  padding: 0 1rem;
}

@media screen and (max-width: 767px) {
  .tk-meta-input {
    flex-direction: column;
  }
  .tk-meta-input .el-input {
    width: auto;
  }
  .tk-meta-input .el-input + .el-input {
    margin-left: 0;
    margin-top: 0.5rem;
  }
}
</style>
