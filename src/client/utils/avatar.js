function normalizeMail (mail) {
  return String(mail).trim().toLowerCase()
}

function isQQ (mail) {
  return /^[1-9][0-9]{4,10}$/.test(mail) ||
    /^[1-9][0-9]{4,10}@qq.com$/i.test(mail)
}

function getQQAvatar (qq) {
  const qqNum = qq.replace(/@qq.com/ig, '')
  return `https://thirdqq.qlogo.cn/g?b=sdk&nk=${qqNum}&s=140`
}

export {
  normalizeMail,
  isQQ,
  getQQAvatar
}
