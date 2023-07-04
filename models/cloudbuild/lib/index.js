const io = require('socket.io-client')
const log = require('@strive-cli/log')
const get = require('lodash/get')
const TIME_OUT = 5 * 60 * 1000
const CONNECT_TIME_OUT = 5 * 1000
const WS_SERVER = 'http://127.0.0.1:7001'
function parseMsg(msg) {
  const action = get(msg, 'data.action')
  const message = get(msg, 'data.payload.message')
  return { action, message }
}
class CloudBuild {
  constructor(git, options) {
    this.git = git
    this.buildCmd = options.buildCmd
    this.timeout = TIME_OUT
    this.socket = null
  }

  handleTimeout(fn, timeout) {
    this.timer && clearTimeout(this.timer)
    log.info(`设置任务超时事件: ${timeout / 1000}秒`)
    this.timer = setTimeout(fn, timeout)
  }

  async init() {
    return new Promise((resolve, reject) => {
      const socket = io(WS_SERVER, {
        query: {
          repo: this.git.remote,
          name: this.git.name,
          branch: this.git.branch,
          version: this.git.version,
          buildCmd: this.buildCmd
        }
      })

      socket.on('connect', () => {
        clearTimeout(this.timer)
        const { id } = socket
        log.success('云构建任务创建成功', `任务ID: ${id}`)
        socket.on(id, msg => {
          const parsedMsg = parseMsg(msg)
          log.success(parsedMsg.action, parsedMsg.message)
        })
        resolve()
      })

      socket.on('disconnect', () => {
        log.success('disconnect', '云构建任务断开')
        disconnect()
      })

      socket.on('error', err => {
        log.error('error', '云构建出错!', err)
        disconnect()
        reject()
      })

      const disconnect = () => {
        clearTimeout(this.timer)
        socket.disconnect()
        socket.close()
      }

      this.handleTimeout(() => {
        log.error('云构建服务连接超时, 自动终止')
        disconnect()
      }, CONNECT_TIME_OUT)
      this.socket = socket
    })
  }

  build() {
    return new Promise((resolve, reject) => {
      this.socket.emit('build')
      this.socket.on('build', msg => {
        const parsedMsg = parseMsg(msg)
        log.success(parsedMsg.action, parsedMsg.message)
      })
      this.socket.on('building', msg => {})
    })
  }
}

module.exports = CloudBuild
