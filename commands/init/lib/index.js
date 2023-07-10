const fs = require('fs')
const path = require('path')
const { homedir } = require('os')
const inquirer = require('inquirer')
const fse = require('fs-extra')
const semver = require('semver')
const kbc = require('kebab-case')
const { glob } = require('glob')
const ejs = require('ejs')
const Command = require('@strive-cli/command')
const Package = require('@strive-cli/package')
const log = require('@strive-cli/log')
const { spinnerStart, sleep, spawnAsync } = require('@strive-cli/utils')
const getTemplate = require('./getTemplate')

// 初始化项目类型
const PROJECT_TYPE = 'project'
const COMPONENT_TYPE = 'component'

// 安装模板类型
const TEMPLATE_TYPE_NORMAL = 'normal'
const TEMPLATE_TYPE_CUSTOM = 'custom'

const WHITE_COMMAND = ['npm', 'cnpm']
const COMPONENT_FILE = '.componentrc'
class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || ''
    this.force = !!this._argv[1].force
  }

  async exec() {
    try {
      const projectInfo = await this.prepare()
      if (projectInfo) {
        this.projectInfo = projectInfo
        await this.downloadTemplate()
        await this.installTemplate()
      }
    } catch (e) {
      log.error(e.message)
      if (process.env.LOG_LEVEL === 'verbose') {
        console.log(e)
      }
    }
  }
  async prepare() {
    // 首先判断数据库中是否有模板
    const templates = await getTemplate()
    if (!templates || !templates.length) {
      throw new Error('项目模板不存在！')
    }

    this.templates = templates
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
        if (!isContinue) return
      }

      const { isConfirm } = await inquirer.prompt({
        type: 'confirm',
        name: 'isConfirm',
        default: false,
        message: '是否确认清空当前目录下的文件？'
      })

      if (isConfirm) {
        // let spinner = spinnerStart('正在清空当前目录文件...')
        fse.emptyDirSync(localPath)
        // spinner.stop(true)
      }
    }
    return this.getProjectInfo()
  }

  async installTemplate() {
    if (!this.curTemplateInfo.type) {
      this.curTemplateInfo.type = TEMPLATE_TYPE_NORMAL
    }

    if (this.curTemplateInfo.type === TEMPLATE_TYPE_NORMAL) {
      await this.installNormal()
    } else if (this.curTemplateInfo.type === TEMPLATE_TYPE_CUSTOM) {
      await this.installCustom()
    } else {
      throw new Error('项目模板类型无法识别！')
    }
  }

  async installNormal() {
    const templatePath = path.resolve(
      this.curTemplateNpm.cacheFilePath,
      'template'
    )
    const targetPath = process.cwd()
    let spinner = spinnerStart('正在安装模板...')
    try {
      fse.ensureDirSync(templatePath)
      fse.copySync(templatePath, targetPath)
    } catch (e) {
      throw e
    } finally {
      spinner.stop(true)
      log.success('模板安装成功')
    }

    const {
      installCommand,
      startCommand,
      ignore: templateIgnore
    } = this.curTemplateInfo
    // 避免渲染public下 webpack的html模板

    const ign = templateIgnore || []
    await this.ejsRender({ ignore: ['**/node_modules/**', ...ign] })
    // 如果是组件类型，要生成组件配置文件
    await this.createComponentrcFile(targetPath)
    let installRes
    installRes = await this.execCommand(installCommand)
    if (installRes !== 0) {
      throw new Error('依赖安装过程失败！')
    }
    await this.execCommand(startCommand)
  }

  async createComponentrcFile(targetPath) {
    const curTemplateInfo = this.curTemplateInfo
    const projectInfo = this.projectInfo
    if (curTemplateInfo.tag.includes(COMPONENT_TYPE)) {
      const componentData = {
        ...projectInfo,
        buildPath: curTemplateInfo.buildPath,
        examplePath: curTemplateInfo.examplePath,
        npmName: curTemplateInfo.npmName,
        npmVersion: curTemplateInfo.version
      }
      const componentFile = path.resolve(targetPath, COMPONENT_FILE)
      fs.writeFileSync(componentFile, JSON.stringify(componentData))
    }
  }

  async installCustom() {
    if (await this.curTemplateNpm.exists()) {
      const rootFilePath = this.curTemplateNpm.getRootFilePath()
      if (fs.existsSync(rootFilePath)) {
        const templatePath = path.resolve(
          this.curTemplateNpm.cacheFilePath,
          'template'
        )
        const options = {
          templateInfo: this.curTemplateInfo,
          projectInfo: this.projectInfo,
          targetPath: process.cwd(),
          sourcePath: templatePath
        }
        const code = `require('${rootFilePath}')(${JSON.stringify(options)})`
        await spawnAsync('node', ['-e', code], {
          stdio: 'inherit',
          cwd: process.cwd()
        })
        log.success('自定义模板安装成功')
      } else {
        throw new Error('自定义模板文件入口不存在！')
      }
    }
  }

  async downloadTemplate() {
    const userHome = homedir()
    const { projectTemplate } = this.projectInfo
    this.curTemplateInfo = this.templates.find(
      t => t.npmName === projectTemplate
    )
    const { npmName, version } = this.curTemplateInfo
    // 固定, 与--targetPath无关
    let targetPath = path.resolve(userHome, '.strive-cli', 'template')
    let storeDir = path.resolve(targetPath, 'node_modules')
    const curTemplateNpm = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version
    })
    if (!(await curTemplateNpm.exists(true))) {
      const spinner = spinnerStart('正在下载模板')
      await sleep(1000)
      try {
        await curTemplateNpm.install()
      } catch (e) {
        throw e
      } finally {
        spinner.stop(true)
        if (await curTemplateNpm.exists()) {
          this.curTemplateNpm = curTemplateNpm
          log.success('下载模板成功！')
        }
      }
    } else {
      this.curTemplateNpm = curTemplateNpm
    }
  }

  async ejsRender({ ignore }) {
    const dir = process.cwd()
    const projectInfo = this.projectInfo
    const files = await glob('**', {
      cwd: dir,
      ignore,
      nodir: true
    })
    return Promise.all(
      files.map(file => {
        const filePath = path.join(dir, file)
        return new Promise((resolve, reject) => {
          ejs.renderFile(filePath, projectInfo, (err, res) => {
            if (err) {
              reject(err)
            } else {
              fs.writeFileSync(filePath, res)
              resolve(res)
            }
          })
        })
      })
    ).catch(e => log.error(e.message))
  }

  async getProjectInfo() {
    let projectInfo = {}
    let isProjectNameValid = false
    function isValidName(v) {
      // 合法: a, a_b, a-b-c, a_b_c, a-b1-c1, a_b1_c1
      // 不合法:1, a_, a-, a_1,a-1
      return /^(@[a-zA-Z0-9-_]+\/)?[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])$/.test(
        v
      )
    }
    if (isValidName(this.projectName)) {
      isProjectNameValid = true
      projectInfo.projectName = this.projectName
    }
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

    this.templates = this.templates.filter(t => t.tag.includes(type))
    let name = type === PROJECT_TYPE ? '项目' : '组件库'

    let projectNamePrompt = {
      type: 'input',
      message: `请输入${name}名称`,
      name: 'projectName',
      default: '',
      validate(v) {
        const done = this.async()
        if (!isValidName(v)) {
          done('请输入合法的项目名称')
          return
        }
        done(null, true)
        return
      }
    }
    let prompt = []
    if (!isProjectNameValid) {
      prompt.push(projectNamePrompt)
    }
    prompt.push(
      {
        type: 'input',
        message: `请输入${name}版本号`,
        name: 'projectVersion',
        default: '1.0.0',
        validate(v) {
          const done = this.async()
          if (!semver.valid(v)) {
            done(`请输入合法的${name}名称`)
            return
          }
          done(null, true)
          return
        }
      },
      {
        type: 'list',
        message: `请选择${name}模板`,
        name: 'projectTemplate',
        // default: '1.0.0',
        choices: this.createTemplateChoice()
      }
    )
    if (type === PROJECT_TYPE) {
      const project = await inquirer.prompt(prompt)
      projectInfo = {
        ...projectInfo,
        type,
        ...project
      }
    } else if (type === COMPONENT_TYPE) {
      let projectDescPrompt = {
        type: 'input',
        message: '请输入组件库描述信息',
        name: 'componentDesc',
        default: ''
      }
      prompt.push(projectDescPrompt)
      const component = await inquirer.prompt(prompt)
      projectInfo = {
        ...projectInfo,
        type,
        ...component
      }
    }
    projectInfo.className = kbc(projectInfo.projectName).replace(/^-/, '')
    projectInfo.version = projectInfo.projectVersion
    if (projectInfo.componentDesc) {
      projectInfo.description = projectInfo.componentDesc
    }
    return projectInfo
  }

  async execCommand(originCmd) {
    if (originCmd) {
      const command = originCmd.split(' ')
      const cmd = this.checkCommand(command[0])
      const args = command.slice(1)
      if (!cmd) throw new Error('执行命令不存在或不在白名单中！')
      return spawnAsync(cmd, args, {
        cwd: process.cwd(),
        stdio: 'inherit'
      })
    }
  }

  createTemplateChoice() {
    return this.templates.map(t => {
      return {
        value: t.npmName,
        name: t.name
      }
    })
  }

  isDirEmpty(localPath) {
    let fileList = fs.readdirSync(localPath)
    fileList = fileList.filter(file => {
      return !file.startsWith('.') && ['node_modules'].indexOf(file) < 0
    })
    return !fileList || !fileList.length
  }

  checkCommand(cmd) {
    return WHITE_COMMAND.includes(cmd) ? cmd : null
  }
}

const init = argv => {
  return new InitCommand(argv)
}

module.exports = init
module.exports.InitCommand = InitCommand
