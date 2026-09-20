/**
 * 腾讯云开发（CloudBase）一键部署入口：纯转发壳，实现全在 `twikoo-func`。
 *
 * 与控制台「手动部署」的第 7 步同形（`exports.main = require("twikoo-func").main`）——
 * 云函数侧不执行本仓库的构建，所以入口必须是纯 JS；依赖写 `latest`，
 * 升级时重新部署即可取到新版，不需要改版本号。
 */
exports.main = require("twikoo-func").main;
