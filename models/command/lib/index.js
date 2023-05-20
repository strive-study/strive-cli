const semver = require('semver')
const colors = require('colors')
const log = require('@strive-cli/log')
const LOWEST_NODE_VERSION = '12.0.0'

class Command {
  constructor(argv) {
    // console.log('command class!', argv)
    if (!argv) {
      throw new Error('参数不能为空!')
    }

    if (!Array.isArray(argv)) {
      throw new Error('参数必须为数组!')
    }
    if (!argv.length) {
      throw new Error('参数列表不能为空!')
    }
    this._argv = argv
    let runner = new Promise((resolve, reject) => {
      let chain = Promise.resolve()
      chain = chain
        .then(() => this.checkNodeVersion())
        .then(() => this.initArgs())
        // 用户自定义的init exec 方法
        .then(() => this.init())
        .then(() => this.exec())
        .catch(e => log.error(e.message))
      // chain = chain.then(() => this.checkNodeVersion())
      // chain = chain.then(() => this.initArgs())
      // chain = chain.then(() => this.init())
      // chain = chain.then(() => this.exec())
      // chain.catch(e => log.error(e.message))
    })
  }
  checkNodeVersion = () => {
    console.log('check node')
    const nodeVersion = process.version
    if (!semver.gte(nodeVersion, LOWEST_NODE_VERSION)) {
      throw new Error(
        colors.red(`strive-cli 需要使用 v${LOWEST_NODE_VERSION} 以上的版本`)
      )
    }
  }

  initArgs() {
    console.log('initArgs')
    this.cmd = this._argv[this._argv.length - 1]
    this._argv = this._argv.slice(0, this._argv.length - 1)
  }

  init() {
    throw new Error('init必须实现！')
  }

  exec() {
    throw new Error('exec必须实现！')
  }
}

module.exports = Command
