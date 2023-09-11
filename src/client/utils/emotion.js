import { logger } from '.'

function initOwoEmotion (api) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
          const odata = formatOdata(JSON.parse(xhr.responseText))
          resolve(odata)
        } else {
          logger.warn('OwO data request was unsuccessful: ' + xhr.status)
        }
      }
    }
    xhr.open('get', api, true)
    xhr.send(null)
  })
}

async function initOwoEmotions (apis) {
  const odata = {}
  const odatas = await Promise.all(apis.split(',').map((api) => initOwoEmotion(api.trim())))
  Object.assign(odata, ...odatas)
  return odata
}

// 格式化不规范的 OwO 数据格式
function formatOdata (odata) {
  try {
    Object.values(odata).forEach(item => {
      if (item.type === 'image') {
        for (const image of item.container) {
          if (!image.text) {
            // 缺少 text 的，取 img 文件名作为 text
            image.text = getFilename(getImgSrc(image.icon))
          }
        }
      }
    })
    return odata
  } catch (e) {
    logger.warn('OwO data is bad: ', e)
  }
}

const template = document.createElement('template')
function getImgSrc (html) {
  try {
    template.innerHTML = html
    return template.content.childNodes[0].src
  } catch (e) {
    return ''
  }
}

function getFilename (url) {
  return url.split('#').shift().split('?').shift().split('/').pop()
}

function initMarkedOwo (odata) {
  if (odata && Object.values(odata)) {
    const imgs = {}
    Object
      .values(odata)
      .forEach(item => {
        item.container.forEach(img => {
          const imgSrc = getImgSrc(img.icon)
          if (imgSrc) {
            imgs[img.text] = imgSrc
          }
        })
      })
    return imgs
  }
}

export {
  initOwoEmotions,
  initMarkedOwo
}
