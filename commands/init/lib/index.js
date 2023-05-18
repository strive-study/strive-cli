const fs = require('fs')
const inquirer = require('inquirer')
const fse = require('fs-extra')
const Command = require('@strive-cli/command')
const log = require('@strive-cli/log')

const PROJECT_TYPE = 'project'
const COMPONENT_TYPE = 'component'
class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || ''
    this.force = !!this._argv[1].force
    log.verbose('init', this.projectName, this.force)
  }

  async exec() {
    console.log('exec')
    try {
      const res = await this.prepare()
      if (res) {
        console.log('继续')
      }
    } catch (e) {
      log.error(e.message)
    }
  }

  async prepare() {
    const localPath = process.cwd()
    if (!this.isDirEmpty(localPath)) {
      let isContinue = false
      if (!this.force) {
        isContinue = (
          await inquirer.prompt({
            type: 'confirm',
            name: 'isContinue',
            default: false,
            message: '当前文件夹不为空，是否继续？'
          })
        ).isContinue
        console.log(isContinue)
        if (!isContinue) return
      }

      const { isConfirm } = await inquirer.prompt({
        type: 'confirm',
        name: 'isConfirm',
        default: false,
        message: '是否确认清空当前目录下的文件？'
      })

      if (isConfirm) {
        fse.emptyDirSync(localPath)
      }
    }
    return this.getProjectInfo()
  }

  async getProjectInfo() {
    let projectInfo = {}
    const { type } = await inquirer.prompt({
      type: 'list',
      name: 'type',
      message: '请选择初始化类型',
      default: PROJECT_TYPE,
      choices: [
        {
          name: '项目',
          value: PROJECT_TYPE
        },
        {
          name: '组件',
          value: COMPONENT_TYPE
        }
      ]
    })
    if (type === PROJECT_TYPE) {
      const o = await inquirer.prompt([
        {
          type: 'input',
          message: '请输入项目名称',
          name: 'projectName',
          default: '',
          validate(v) {
            return typeof v === 'string'
          },
          filter(v) {
            return v
          }
        },
        {
          type: 'input',
          message: '请输入项目版本号',
          name: 'projectVersion',
          default: '1.0.0',
          validate(v) {
            return typeof v === 'string'
          },
          filter(v) {
            return v
          }
        }
      ])
      console.log(o)
    } else if (type === COMPONENT_TYPE) {
    }
    log.verbose('选择', type)
    return projectInfo
  }

  isDirEmpty(localPath) {
    let fileList = fs.readdirSync(localPath)
    fileList = fileList.filter(file => {
      return !file.startsWith('.') && ['node_modules'].indexOf(file) < 0
    })
    return !fileList || !fileList.length
  }
}

const init = argv => {
  return new InitCommand(argv)
}

module.exports = init
module.exports.InitCommand = InitCommand
