const Command = require('@strive-cli/command')
const log = require('@strive-cli/log')

class PublishCommand extends Command {
  init() {
    // 参数处理
    log.verbose('init', this._argv)
    log.verbose('init', this.cmd)
  }

  exec() {
    try {
    } catch (e) {
      log.error(e.message)
      if (process.env.LOG_LEVEL === 'verbose') {
        console.log(e)
      }
    }
  }
}
const init = argv => {
  return new PublishCommand(argv)
}
module.exports = init
module.exports.PublishCommand = PublishCommand
