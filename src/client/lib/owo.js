/*!
 * OwO v1.0.2
 * Source: https://github.com/DIYgod/OwO/blob/master/src/OwO.js
 * Author: DIYgod
 * Modified by: iMaeGoo
 * Released under the MIT License.
 */

export default class OwO {
  constructor (option) {
    const defaultOption = {
      logo: 'OwO表情',
      container: document.getElementsByClassName('OwO')[0],
      target: document.getElementsByTagName('textarea')[0],
      position: 'down',
      maxHeight: '250px',
      odata: {}
    }
    for (const defaultKey in defaultOption) {
      if (defaultOption[defaultKey] && !option[defaultKey]) {
        option[defaultKey] = defaultOption[defaultKey]
      }
    }
    this.container = option.container
    this.target = option.target
    if (option.position === 'up') {
      this.container.classList.add('OwO-up')
    }

    this.odata = option.odata
    setTimeout(() => { this.init(option) })
  }

  init (option) {
    this.area = option.target
    this.packages = Object.keys(this.odata)

    // fill in HTML
    let html = `<div class="OwO-logo">${option.logo}</div>` +
        '<div class="OwO-body">'

    for (let i = 0; i < this.packages.length; i++) {
      html += `<ul class="OwO-items OwO-items-${this.odata[this.packages[i]].type}" style="max-height: ${parseInt(option.maxHeight) - 53 + 'px'};">`

      const opackage = this.odata[this.packages[i]].container
      for (let i = 0; i < opackage.length; i++) {
        const icon = opackage[i].icon.replace('<img', '<img loading="lazy"')
        html += `<li class="OwO-item" title="${opackage[i].text}">${icon}</li>`
      }

      html += '</ul>'
    }

    html += '<div class="OwO-bar">' +
        '<ul class="OwO-packages">'

    for (let i = 0; i < this.packages.length; i++) {
      html += `<li><span>${this.packages[i]}</span></li>`
    }

    html += '</ul></div></div>'
    this.container.innerHTML = html

    // bind event
    this.logo = this.container.getElementsByClassName('OwO-logo')[0]
    this.logo.addEventListener('click', () => {
      this.toggle()
    })

    this.container.getElementsByClassName('OwO-body')[0].addEventListener('click', (e) => {
      let target = null
      if (e.target.classList.contains('OwO-item')) {
        target = e.target
      } else if (e.target.parentNode.classList.contains('OwO-item')) {
        target = e.target.parentNode
      }
      if (target) {
        const cursorPos = this.area.selectionEnd
        const areaValue = this.area.value
        let innerHTML = target.innerHTML
        if (innerHTML.indexOf('<img') !== -1) {
          if (target.title) {
            innerHTML = ':' + target.title + ': '
          } else {
            // 图片表情转换为 markdown
            const start = innerHTML.indexOf('src="') + 'src="'.length
            const end = innerHTML.indexOf('"', start)
            if (start !== -1 && end !== -1) {
              innerHTML = `![${target.title || ''}](${innerHTML.substring(start, end)})`
            }
          }
        }
        this.area.value = areaValue.slice(0, cursorPos) + innerHTML + areaValue.slice(cursorPos)
        // 手动触发 input 事件
        this.area.dispatchEvent(new InputEvent('input'))
        this.area.focus()
        this.toggle()
      }
    })

    this.packagesEle = this.container.getElementsByClassName('OwO-packages')[0]
    for (let i = 0; i < this.packagesEle.children.length; i++) {
      ((index) => {
        this.packagesEle.children[i].addEventListener('click', () => {
          this.tab(index)
        })
      })(i)
    }

    this.tab(0)
  }

  toggle () {
    if (this.container.classList.contains('OwO-open')) {
      this.container.classList.remove('OwO-open')
    } else {
      this.container.classList.add('OwO-open')
    }
  }

  tab (index) {
    const itemsShow = this.container.getElementsByClassName('OwO-items-show')[0]
    if (itemsShow) {
      itemsShow.classList.remove('OwO-items-show')
    }
    this.container.getElementsByClassName('OwO-items')[index].classList.add('OwO-items-show')

    const packageActive = this.container.getElementsByClassName('OwO-package-active')[0]
    if (packageActive) {
      packageActive.classList.remove('OwO-package-active')
    }
    this.packagesEle.getElementsByTagName('li')[index].classList.add('OwO-package-active')
  }
}
