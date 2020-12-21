<template>
  <div id="twikoo" class="twikoo">
    <tk-comments @admin="showAdmin = true" />
    <tk-footer />
    <tk-admin :show="showAdmin" @close="showAdmin = false" />
  </div>
</template>

<script>
import TkComments from './components/TkComments.vue'
import TkFooter from './components/TkFooter.vue'
import TkAdmin from './components/TkAdmin.vue'

export default {
  components: {
    TkComments,
    TkFooter,
    TkAdmin
  },
  data () {
    return {
      showAdmin: false
    }
  }
}
</script>

<style>
.twikoo {
  position: relative;
}
.twikoo svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

/* 全局 CSS */
.tk-expand {
  width: 100%;
  cursor: pointer;
  padding: 0.75em;
  text-align: center;
  transition: all 0.5s;
}
.tk-expand:hover {
  background-color: #00000020;
}
.tk-expand:active {
  background-color: #00000030;
}
.tk-content img {
  max-width: 300px;
  max-height: 300px;
  vertical-align: middle;
}

/* element-ui overwrite */
.twikoo .el-input__inner,
.twikoo .el-textarea__inner {
  color: currentColor;
  background-color: transparent;
  border-color: #90939950;
}
.twikoo .el-input__inner:hover,
.twikoo .el-textarea__inner:hover {
  border-color: #90939980;
}
.twikoo .el-input__inner:focus,
.twikoo .el-textarea__inner:focus {
  border-color: #409eff;
}
.twikoo .el-input-group__append,
.twikoo .el-input-group__prepend {
  color: currentColor;
  background-clip: padding-box;
  background-color: #90939920;
  border-color: #90939950;
}
.twikoo .el-button:not(.el-button--primary):not(.el-button--text) {
  color: currentColor;
  background-color: #90939910;
  border-color: #90939950;
}
.twikoo .el-button:not(.el-button--primary):not(.el-button--text):active,
.twikoo .el-button:not(.el-button--primary):not(.el-button--text):focus,
.twikoo .el-button:not(.el-button--primary):not(.el-button--text):hover {
  color: #409eff;
  background-color: #409eff10;
  border-color: #409eff80;
}
.twikoo .el-button--primary.is-disabled,
.twikoo .el-button--primary.is-disabled:active,
.twikoo .el-button--primary.is-disabled:focus,
.twikoo .el-button--primary.is-disabled:hover {
  color: #ffffffa0;
  background-color: #409eff80;
  border-color: transparent;
}
.twikoo .el-loading-mask {
  background-color: transparent;
  backdrop-filter: blur(5px);
}
</style>
