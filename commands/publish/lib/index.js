const path = require('path')
const fs = require('fs')
const Command = require('@strive-cli/command')
const log = require('@strive-cli/log')
const Git = require('@strive-cli/git')
const fse = require('fs-extra')

class PublishCommand extends Command {
  init() {
    // 参数处理
    this.options = this.cmd.opts
    log.verbose('publish参数', this._argv)
  }

  async exec() {
    try {
      const startTime = new Date().getTime()
      // 初始化检查
      this.prepare()
      // gitflow自动化
      const git = new Git(this.projectInfo, this.options)
      // 自动化提交准备和仓库初始化
      await git.prepare()
      // 代码自动化提交
      await git.commit()
      // 云构建云发布
      await git.publish()
      const endTime = new Date().getTime()
      log.info(`本次发布耗时：${Math.floor(endTime - startTime) / 1000}秒`)
    } catch (e) {
      log.error(e.message)
      if (process.env.LOG_LEVEL === 'verbose') {
        console.log(e)
      }
    }
  }
  prepare() {
    // 1.是否为npm项目
    const projectPath = process.cwd()
    const pkgPath = path.resolve(projectPath, 'package.json')
    if (!fs.existsSync(pkgPath)) {
      throw new Error('package.json不存在！')
    }
    // 2.是否包含name、version、以及build命令
    const { name, version, scripts } = fse.readJSONSync(pkgPath)
    if (!name) {
      throw new Error('package.json中缺少name字段！')
    }
    if (!version) {
      throw new Error('package.json中缺少version字段！')
    }
    if (!scripts) {
      throw new Error('package.json中缺少scripts字段！')
    }
    if (!scripts.build) {
      throw new Error('package.json中scripts字段缺少build命令！')
    }
    this.projectInfo = {
      name,
      version,
      dir: projectPath // 项目目录
    }
  }
}
const init = argv => {
  return new PublishCommand(argv)
}
module.exports = init
module.exports.PublishCommand = PublishCommand
