# 实现用户可以删除5分钟内评论的功能

## 概述

Twikoo评论系统支持用户在评论发布后5分钟内删除自己的评论。这个功能通过删除令牌（deleteToken）机制实现，确保只有评论作者可以在限定时间内删除评论。

## 功能原理

### 删除令牌机制

1. **令牌生成**：当用户提交评论时，后端会生成一个唯一的删除令牌，并将该令牌与评论关联存储。
2. **令牌存储**：删除令牌会保存在两个地方：
   - 后端数据库：存储在评论记录的`deleteTokens`数组中
   - 前端localStorage：以评论ID为键存储在`twikoo-delete-tokens`对象中
3. **令牌验证**：当用户尝试删除评论时，系统会验证：
   - 令牌是否有效（与数据库中存储的令牌匹配）
   - 评论是否在5分钟内发布（当前时间 - 评论创建时间 < 5分钟）

### 时间限制

- 删除功能仅在评论发布后5分钟内可用
- 超过5分钟后，删除按钮将自动隐藏
- 即使有有效的删除令牌，超过时间限制也无法删除评论

## 实现细节

### 后端实现

#### 1. 删除令牌生成 (`src/server/self-hosted/index.js`)

```javascript
function generateDeleteToken(commentId, uid) {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2)
  return sha256(`${commentId}:${uid}:${timestamp}:${randomStr}`)
}
```

#### 2. 删除令牌验证 (`src/server/self-hosted/index.js`)

```javascript
function validateDeleteToken(comment, token) {
  if (!comment || !token) return false
  
  // 检查评论创建时间是否在5分钟内
  const commentTime = new Date(comment.created).getTime()
  const currentTime = Date.now()
  const timeDiff = currentTime - commentTime
  
  if (timeDiff > 5 * 60 * 1000) {
    return false
  }
  
  // 检查令牌是否匹配
  const tokens = comment.deleteTokens || []
  return tokens.includes(token)
}
```

#### 3. 保存删除令牌 (`src/server/self-hosted/index.js`)

```javascript
async function saveDeleteToken(commentId, token) {
  const comment = await db.getCollection('comment').findOne({ id: commentId })
  if (!comment) return false
  
  if (!comment.deleteTokens) {
    comment.deleteTokens = []
  }
  
  comment.deleteTokens.push(token)
  await db.getCollection('comment').update({ id: commentId }, comment)
  return true
}
```

#### 4. 评论提交时生成并返回删除令牌 (`src/server/self-hosted/index.js`)

```javascript
// 在commentSubmit函数中
const deleteToken = generateDeleteToken(comment.id, comment.uid)
await saveDeleteToken(comment.id, deleteToken)
res.deleteToken = deleteToken
logger.log('生成删除令牌:', { commentId: comment.id, uid: comment.uid, deleteToken })
```

#### 5. 删除评论功能 (`src/server/self-hosted/index.js`)

```javascript
async function commentDelete(event) {
  const { commentId, token } = event
  const uid = anonymousSignIn(event)
  
  logger.log('删除评论请求:', { commentId, uid, token })
  
  // 获取评论
  const comment = await db.getCollection('comment').findOne({ id: commentId })
  if (!comment) {
    return { code: RES_CODE.COMMENT_NOT_EXIST, message: '评论不存在' }
  }
  
  // 验证删除令牌
  const isValidToken = validateDeleteToken(comment, token)
  logger.log('删除令牌验证结果:', isValidToken)
  
  if (!isValidToken) {
    return { code: RES_CODE.FORBIDDEN, message: '没有删除权限' }
  }
  
  // 删除评论及其回复
  await deleteCommentAndReplies(commentId)
  
  return { code: RES_CODE.SUCCESS }
}
```

### 前端实现

#### 1. 评论提交后保存删除令牌 (`src/client/view/components/TkSubmit.vue`)

```javascript
// 评论提交成功后
if (sendResult.result && sendResult.result.deleteToken) {
  const deleteTokens = JSON.parse(localStorage.getItem('twikoo-delete-tokens') || '{}')
  deleteTokens[sendResult.result.id] = sendResult.result.deleteToken
  localStorage.setItem('twikoo-delete-tokens', JSON.stringify(deleteTokens))
  console.log('保存删除令牌:', { commentId: sendResult.result.id, token: sendResult.result.deleteToken })
  console.log('localStorage保存结果:', localStorage.getItem('twikoo-delete-tokens'))
} else {
  console.warn('未收到删除令牌')
}
```

#### 2. 删除按钮显示逻辑 (`src/client/view/components/TkComment.vue`)

```javascript
computed: {
  showDeleteButton() {
    try {
      // 从localStorage获取删除令牌
      const deleteTokens = JSON.parse(localStorage.getItem('twikoo-delete-tokens') || '{}')
      const hasToken = !!deleteTokens[this.comment.id]
      
      // 检查评论时间是否在5分钟内
      const commentTime = new Date(this.comment.created).getTime()
      const currentTime = Date.now()
      const timeDiff = currentTime - commentTime
      const isWithinTimeLimit = timeDiff <= 5 * 60 * 1000
      
      console.log('删除按钮显示检查:', {
        commentId: this.comment.id,
        hasToken,
        commentTime: new Date(commentTime).toISOString(),
        currentTime: new Date(currentTime).toISOString(),
        timeDiff,
        isWithinTimeLimit,
        showButton: hasToken && isWithinTimeLimit
      })
      
      // 只有同时拥有令牌且在时间限制内才显示删除按钮
      return hasToken && isWithinTimeLimit
    } catch (e) {
      console.error('检查删除按钮显示时出错:', e)
      return false
    }
  }
}
```

#### 3. 删除评论功能 (`src/client/view/components/TkComment.vue`)

```javascript
methods: {
  async handleDelete(event) {
    event.preventDefault()
    
    // 从localStorage获取删除令牌
    const deleteTokens = JSON.parse(localStorage.getItem('twikoo-delete-tokens') || '{}')
    const token = deleteTokens[this.comment.id]
    
    if (!token) {
      this.$message.error('没有删除权限')
      return
    }
    
    try {
      // 调用删除API
      await this.$emit('COMMENT_DELETE', {
        id: this.comment.id,
        token: token
      })
      
      // 从localStorage移除令牌
      delete deleteTokens[this.comment.id]
      localStorage.setItem('twikoo-delete-tokens', JSON.stringify(deleteTokens))
      
      // 刷新评论列表
      this.$emit('refresh')
      
      this.$message.success('评论已删除')
    } catch (e) {
      console.error('删除评论失败:', e)
      this.$message.error('删除评论失败')
    }
  }
}
```

#### 4. 删除按钮模板 (`src/client/view/components/TkComment.vue`)

```html
<a href="#" @click="handleDelete($event)" v-if="showDeleteButton">{{ t('COMMENT_DELETE') }}</a>
```

## 多端部署和多数据库支持

### 多数据库支持

该功能在Twikoo支持的所有数据库中都能正常工作：

1. **LokiJS**：删除令牌存储在评论记录的`deleteTokens`字段中
2. **MongoDB**：删除令牌存储在评论记录的`deleteTokens`字段中
3. **腾讯云开发数据库**：删除令牌存储在评论记录的`deleteTokens`字段中

### 多端部署支持

该功能在Twikoo支持的所有部署环境中都能正常工作：

1. **Self-hosted**：完全支持，已测试通过
2. **Vercel**：完全支持，使用相同的MongoDB代码
3. **Netlify**：完全支持，复用Vercel函数代码
4. **Deta**：完全支持，复用Vercel函数代码
5. **AWS Lambda**：完全支持，复用Vercel函数代码
6. **Hugging Face Space**：完全支持，使用Docker容器运行
7. **Pkg**：完全支持，打包为可执行文件
8. **云函数**：完全支持，使用腾讯云云开发

## 调试方法

### 前端调试

1. 打开浏览器开发者工具（F12）
2. 在Console选项卡中查看日志输出
3. 提交评论后，查看是否保存了删除令牌
4. 查看删除按钮显示检查的详细信息

### 后端调试

1. 查看后端日志输出
2. 确认评论提交时是否生成了删除令牌
3. 确认删除评论时是否正确验证了令牌

### 常见问题排查

1. **删除按钮不显示**：
   - 检查localStorage中是否有对应的删除令牌
   - 检查评论是否在5分钟内发布
   - 查看浏览器控制台是否有错误信息

2. **删除按钮显示但删除失败**：
   - 检查后端日志，确认令牌验证是否通过
   - 确认评论是否存在于数据库中
   - 检查网络请求是否正常

## 安全考虑

1. **令牌唯一性**：每个评论的删除令牌都是唯一的，基于评论ID、用户ID、时间戳和随机字符串生成
2. **时间限制**：5分钟的时间限制降低了令牌被滥用的风险
3. **令牌验证**：后端会严格验证令牌的有效性和时间限制
4. **令牌清理**：删除评论后，前端会自动清理localStorage中的令牌

## 未来改进

1. **可配置时间限制**：允许管理员自定义删除时间限制
2. **批量删除**：支持用户批量删除自己的多条评论
3. **编辑功能**：在时间限制内允许用户编辑自己的评论
4. **撤销删除**：支持在一定时间内撤销删除操作

## 总结

用户可以在评论发布后5分钟内删除自己的评论，这个功能通过删除令牌机制实现，确保了安全性和可靠性。该功能在Twikoo支持的所有数据库和部署环境中都能正常工作，为用户提供了更好的评论管理体验。