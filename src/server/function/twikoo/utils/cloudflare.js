function isInCloudflare () {
  return typeof addEventListener === "function"
}

module.exports = {
  isInCloudflare
}
