import { app } from '../view'

const isUrl = (s) => {
  return /^http(s)?:\/\//.test(s)
}

const call = async (tcb, event, data = {}) => {
  const _tcb = tcb || (app ? app.$tcb : null)
  const _envId = data.envId || app.$twikoo.envId
  const _funcName = data.funcName || app?.$twikoo.funcName || 'twikoo'
  if (_tcb) {
    try {
      return await _tcb.app.callFunction({
        name: _funcName,
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
        return await _tcb.app.callFunction({
          name: oldFuncName,
          data: data
        })
      } else {
        throw new Error('请升级 Twikoo 云函数版本再试，如果仍无法解决，请删除并重新创建 Twikoo 云函数 - https://twikoo.js.org')
      }
    }
  } else if (isUrl(_envId)) {
    return await new Promise((resolve, reject) => {
      try {
        const accessToken = localStorage.getItem('twikoo-access-token')
        const xhr = new XMLHttpRequest()

        // 处理网络错误
        xhr.onerror = () => {
          reject(new Error('网络请求失败，请检查网络连接或服务器状态'))
        }

        // 处理超时
        xhr.ontimeout = () => {
          reject(new Error('请求超时，请稍后重试'))
        }

        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            if (xhr.status === 0) {
              // HTTP状态码为0通常表示请求被取消或跨域请求被阻止
              reject(new Error('请求被阻止或无法连接到服务器，请检查CORS配置或服务器状态'))
              return
            }

            if (xhr.status === 200) {
              try {
                const result = JSON.parse(xhr.responseText)
                if (result.accessToken) {
                  localStorage.setItem('twikoo-access-token', result.accessToken)
                }
                // 处理服务器返回的错误代码
                if (result.code === 1001) {
                  // 对于UPLOAD_VOICE事件，检查是否有data属性，如果有则表示上传成功
                  if (event === 'UPLOAD_VOICE' && result.data) {
                    // 上传成功，但有警告信息
                    resolve({ result })
                    return
                  } else if (event === 'UPLOAD_VOICE') {
                    // 上传失败，将错误代码转换为err属性，以便TkSubmit.vue能够正确处理
                    const errorMessage = result.message || '语音上传失败，未知错误'
                    resolve({ result: { ...result, err: errorMessage } })
                    return
                  } else {
                    // 对于其他事件，拒绝Promise并传递错误信息
                    reject(new Error(result.message || '未知错误'))
                    return
                  }
                } else if (result.code && result.code !== 0) {
                  // 处理其他非零错误代码
                  const errorMessage = result.message || '操作失败，未知错误'
                  if (event === 'UPLOAD_VOICE') {
                    // 对于UPLOAD_VOICE事件，将错误信息转换为err属性
                    resolve({ result: { ...result, err: errorMessage } })
                  } else {
                    // 对于其他事件，拒绝Promise并传递错误信息
                    reject(new Error(errorMessage))
                  }
                  return
                }
                resolve({ result })
              } catch (e) {
                reject(new Error('解析响应失败，请检查服务器返回的数据格式'))
              }
            } else {
              reject(new Error(`HTTP错误: ${xhr.status}`))
            }
          }
        }

        xhr.open('POST', _envId, true)
        xhr.timeout = 30000 // 设置30秒超时
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.send(JSON.stringify({ event, accessToken, ...data }))
      } catch (e) {
        reject(new Error('请求初始化失败: ' + e.message))
      }
    })
  } else {
    throw new Error('缺少 envId 配置 - https://twikoo.js.org')
  }
}

export {
  isUrl,
  call
}
