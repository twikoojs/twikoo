const call = async (tcb, event, data = {}) => {
  try {
    return await tcb.app.callFunction({
      name: 'twikoo',
      data: { event, ...data }
    })
  } catch (e) {
    // 向下兼容 0.1.x 版本云函数
    let oldFuncName
    switch (event) {
      case 'COMMENT_LIKE':
        oldFuncName = 'comment-like'
        break
      case 'COMMENT_GET':
        oldFuncName = 'comment-get'
        break
      case 'COMMENT_SUBMIT':
        oldFuncName = 'comment-submit'
        break
      case 'COUNTER_GET':
        oldFuncName = 'counter-get'
        break
    }
    if (oldFuncName) {
      return await tcb.app.callFunction({
        name: oldFuncName,
        data: data
      })
    } else {
      throw new Error('请升级 Twikoo 云函数版本再试 - https://twikoo.js.org')
    }
  }
}

export default call
