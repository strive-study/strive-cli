const Command = require('@strive-cli/command')
const log = require('@strive-cli/log')

class AddCommand extends Command {
  init() {
    log.info('init')
  }

  exec() {
    console.log('exec')
    // 获取页面安装文件夹
    const dir = process.cwd()
    console.log(dir)
    // 获取页面模板

    // 安装页面模板
    // 合并页面模板依赖
  }
}
const init = argv => {
  return new AddCommand(argv)
}

module.exports = init
module.exports.AddCommand = AddCommand
