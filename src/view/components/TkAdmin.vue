<template>
  <div class="tk-admin-container">
    <div class="tk-admin" :class="{ '__show': show }" v-loading="loading">
      <a class="tk-admin-close" @click="onClose" v-html="iconClose"></a>
      <div class="tk-login-title" v-if="needUpdate">
        <div>若要使用评论管理，请更新 Twikoo 云函数</div>
        <a href="https://twikoo.js.org/quick-start.html" target="_blank">https://twikoo.js.org/quick-start.html</a>
      </div>
      <div v-if="!needUpdate">
        <div class="tk-login" v-if="!isLogin && isSetPassword">
          <div class="tk-login-title">Twikoo 评论管理</div>
          <el-input class="tk-password" placeholder="请输入" v-model="password" show-password @keyup.enter.native="onLogin" ref="focusme">
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
          <el-input class="tk-password" placeholder="请粘贴私钥文件内容" v-if="!isSetCredentials" v-model="credentials" ref="focusme">
            <template slot="prepend">私钥文件</template>
          </el-input>
          <el-input class="tk-password" placeholder="密码" v-model="password" show-password>
            <template slot="prepend">设置密码</template>
          </el-input>
          <el-input class="tk-password" placeholder="确认密码" v-model="passwordConfirm" show-password>
            <template slot="prepend">确认密码</template>
          </el-input>
          <el-button class="tk-regist-button" :disabled="!canRegist" @click="onRegist">注册</el-button>
          <div class="tk-login-msg" v-if="loginErrorMessage">{{ loginErrorMessage }}</div>
          <div class="tk-login-msg" v-if="!isSetCredentials">
            <a href="https://twikoo.js.org/faq.html" rel="noopener noreferrer" target="_blank">如何获得私钥</a>
          </div>
        </div>
        <div class="tk-panel" v-if="isLogin">
          <div class="tk-panel-title">
            <div>Twikoo 管理面板</div>
            <a class="tk-panel-logout" @click="onLogout">退出登录</a>
          </div>
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
      needUpdate: false,
      isLogin: false,
      isSetPassword: true,
      isSetCredentials: false,
      credentials: '',
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
        this.password === this.passwordConfirm &&
        (this.isSetCredentials || this.credentials)
    }
  },
  methods: {
    async onLogin () {
      if (!this.password) {
        this.loginErrorMessage = '请输入密码'
        return
      }
      this.loading = true
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
          this.password = ''
          this.checkAuth()
        } catch (err) {
          logger.error('登录失败', err)
        }
      }
      this.loading = false
    },
    async onLogout () {
      this.loading = true
      await this.$tcb.auth.signOut()
      await this.$tcb.auth
        .anonymousAuthProvider()
        .signIn()
      this.isLogin = false
      this.loading = false
    },
    async onRegist () {
      this.loading = true
      const passwordMd5 = md5(this.password)
      const res = await call(this.$tcb, 'SET_PASSWORD', {
        password: passwordMd5,
        credentials: this.credentials
      })
      if (!res.result.code) {
        this.passwordMd5 = ''
        this.isSetPassword = true
        this.onLogin()
      } else {
        this.loginErrorMessage = '注册失败'
        if (res.result.message) {
          this.loginErrorMessage += '，' + res.result.message
        }
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
      setTimeout(() => {
        this.$refs.focusme.focus()
      }, 500)
    },
    async checkAuth () {
      // 检查用户身份
      const currentUser = await this.$tcb.auth.getCurrenUser()
      this.isLogin = currentUser.loginType === 'CUSTOM'
    },
    async checkIfPasswordSet () {
      // 检查是否设置过密码
      try {
        const res = await call(this.$tcb, 'GET_PASSWORD_STATUS')
        this.isSetPassword = res.result.status
      } catch (e) {
        this.needUpdate = true
        this.loading = false
        throw e
      }
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
.tk-admin-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}
.tk-admin {
  position: absolute;
  top: 0;
  left: 100%;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  pointer-events: all;
  background-color: #00000099;
  backdrop-filter: blur(5px);
  transition: all 0.5s ease;
}
.tk-admin::-webkit-scrollbar {
  width: 5px;
  background-color: transparent;
}
.tk-admin::-webkit-scrollbar-track {
  background-color: transparent;
}
.tk-admin::-webkit-scrollbar-thumb {
  background-color: #ffffff50;
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
  text-align: center;
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
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}
.tk-panel-logout {
  font-size: 1rem;
  text-decoration: underline;
  color: #ffffff;
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
