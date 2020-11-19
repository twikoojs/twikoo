<template>
  <div class="tk-admin" :class="{ '__show': show }" v-loading="loading">
    <a class="tk-admin-close" @click="onClose" v-html="iconClose"></a>
    <div class="tk-login" v-if="!isLogin && isSetPassword">
      <div class="tk-login-title">Twikoo 评论管理</div>
      <el-input class="tk-password" placeholder="请输入" v-model="password" show-password @keyup.enter.native="onLogin" ref="password">
        <template slot="prepend">密码</template>
        <el-button slot="append" @click="onLogin">登录</el-button>
      </el-input>
      <div class="tk-login-msg" v-if="loginErrorMessage">
        {{ loginErrorMessage }}
        <a href="https://twikoo.js.org/faq.html" rel="noopener noreferrer" target="_blank">忘记密码</a>
      </div>
    </div>
    <div class="tk-regist" v-if="!isLogin && !isSetPassword">
      <div class="tk-login-title">Twikoo 评论管理</div>
      <el-input class="tk-password" placeholder="请输入" v-model="password" show-password @keyup.enter.native="onLogin" ref="password">
        <template slot="prepend">设置密码</template>
      </el-input>
      <el-input class="tk-password" placeholder="请输入" v-model="passwordConfirm" show-password @keyup.enter.native="onLogin" ref="passwordConfirm">
        <template slot="prepend">确认密码</template>
      </el-input>
      <el-button class="tk-regist-button" :disabled="!canRegist" @click="onRegist">注册</el-button>
      <div class="tk-login-msg" v-if="loginErrorMessage">
        {{ loginErrorMessage }}
        <a href="https://twikoo.js.org/faq.html" rel="noopener noreferrer" target="_blank">忘记密码</a>
      </div>
    </div>
    <div class="tk-panel" v-if="isLogin">
      <div class="tk-panel-title">Twikoo 管理面板</div>
      <el-tabs v-model="activeTabName">
        <el-tab-pane label="评论管理" name="comment">
          <tk-admin-comment />
        </el-tab-pane>
        <el-tab-pane label="配置管理" name="config">
          <tk-admin-config />
        </el-tab-pane>
        <el-tab-pane label="导入" name="import">
          <tk-admin-import />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script>
import md5 from 'blueimp-md5'
import TkAdminComment from './TkAdminComment.vue'
import TkAdminConfig from './TkAdminConfig.vue'
import TkAdminImport from './TkAdminImport.vue'
import { logger, call } from '../../js/utils'
import iconClose from '@fortawesome/fontawesome-free/svgs/solid/times.svg'

export default {
  components: {
    TkAdminComment,
    TkAdminConfig,
    TkAdminImport
  },
  props: {
    show: Boolean
  },
  data () {
    return {
      iconClose,
      loading: true,
      isLogin: false,
      isSetPassword: true,
      password: '',
      passwordConfirm: '',
      loginErrorMessage: '',
      activeTabName: 'comment'
    }
  },
  computed: {
    canRegist () {
      return !this.isSetPassword &&
        !!this.password &&
        this.password === this.passwordConfirm
    }
  },
  methods: {
    async onLogin () {
      this.loading = true
      if (!this.password) {
        this.loginErrorMessage = '请输入密码'
        return
      }
      this.loginErrorMessage = ''
      const passwordMd5 = md5(this.password)
      const res = await call(this.$tcb, 'LOGIN', {
        password: passwordMd5
      })
      if (res.result.message) {
        this.loginErrorMessage = res.result.message
      } else if (res.result.ticket) {
        try {
          await this.$tcb.auth
            .customAuthProvider()
            .signIn(res.result.ticket)
          logger.log('登录成功')
          this.checkAuth()
        } catch (err) {
          logger.error('登录失败', err)
        }
      }
      this.loading = false
    },
    async onRegist () {
      this.loading = true
      const passwordMd5 = md5(this.password)
      const res = await call(this.$tcb, 'SET_PASSWORD', {
        password: passwordMd5
      })
      if (!res.result.code) {
        this.onLogin()
      } else {
        this.loginErrorMessage = '注册失败'
        logger.warn('Twikoo 注册失败', res)
      }
      this.loading = false
    },
    async onShow () {
      this.loading = true
      await this.checkAuth()
      if (!this.isLogin) {
        await this.checkIfPasswordSet()
        this.focusPassword()
      }
      this.loading = false
    },
    focusPassword () {
      // 聚焦密码输入框
      this.$refs.password.focus()
    },
    async checkAuth () {
      // 检查用户身份
      const currentUser = await this.$tcb.auth.getCurrenUser()
      this.isLogin = currentUser.loginType === 'CUSTOM'
    },
    async checkIfPasswordSet () {
      // 检查是否设置过密码
      const res = await call(this.$tcb, 'GET_PASSWORD_STATUS')
      this.isSetPassword = res.result.status
    },
    onClose () {
      this.$emit('close')
    }
  },
  watch: {
    show (val) {
      // 弹出管理面板
      if (val) this.onShow()
    }
  }
}
</script>

<style scoped>
.tk-admin {
  position: absolute;
  top: 0;
  left: 100%;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background-color: #00000099;
  backdrop-filter: blur(5px);
  transition: all 0.5s ease;
}
.tk-admin.__show {
  left: 0;
}
.tk-admin-close {
  position: absolute;
  display: block;
  top: 0;
  right: 0;
  width: 1rem;
  height: 1rem;
  padding: 1rem;
  box-sizing: content-box;
  color: #ffffff;
}
.tk-login,
.tk-regist {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.tk-login-title {
  color: #ffffff;
  font-size: 1.25rem;
  margin-top: 10rem;
}
.tk-password,
.tk-login-msg {
  color: #ffffff;
  width: 80%;
  text-align: center;
  margin-top: 1rem;
}
.tk-login-msg a {
  color: #ffffff;
  margin-left: 1em;
  text-decoration: underline;
}
.tk-regist-button {
  margin-top: 1rem;
}
.tk-panel {
  padding: 2rem;
}
.tk-panel-title {
  color: #ffffff;
  font-size: 1.5rem;
}
.tk-panel .el-tab-pane {
  display: flex;
  flex-direction: column;
  color: #ffffff;
}
.tk-panel /deep/ .el-tabs__item.is-active,
.tk-panel /deep/ .el-tabs__item:hover {
  color: #ffffff;
}
.tk-panel /deep/ .el-tabs__active-bar {
  background-color: #ffffff;
}
.tk-panel /deep/ .el-tabs__item {
  color: #c0c4cc;
}
.tk-panel /deep/ .el-tabs__nav-wrap::after {
  background-color: #c0c4cc;
}
</style>
