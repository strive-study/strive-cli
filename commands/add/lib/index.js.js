const path = require('path')
const fs = require('fs')
const { homedir } = require('os')
const inquirer = require('inquirer')
const pathExists = require('path-exists')
const fse = require('fs-extra')
const { glob } = require('glob')
const ejs = require('ejs')
const pkgUp = require('pkg-up')
const Command = require('@strive-cli/command')
const Package = require('@strive-cli/package')
const semver = require('semver')
const { sleep, spinnerStart, spawnAsync } = require('@strive-cli/utils')
const log = require('@strive-cli/log')
const PAGE_TEMPLATE = [
  {
    name: 'Vue3首页模板',
    npmName: 'strive-cli-template-page-vue3',
    version: 'latest',
    targetPath: 'src/views/Home',
    ignore: ['assets/**']
  }
]
class AddCommand extends Command {
  init() {
    log.info('init')
  }

  async exec() {
    this.dir = process.cwd() // 获取页面安装文件夹
    const pageTemplate = await this.getPageTemplate() // 获取页面模板
    this.pageTemplate = pageTemplate
    await this.downloadTemplate() // 下载页面模板
    await this.prepare() // 检查目录重名
    await this.installTemplate() // 安装页面模板
    // 合并页面模板依赖
  }

  async installTemplate() {
    log.info('开始安装页面模板')
    const templatePath = path.resolve(
      this.pageTemplatePkg.cacheFilePath,
      'template',
      this.pageTemplate.targetPath
    )
    if (!(await pathExists(templatePath))) {
      throw new Error('页面模板不存在')
    }
    const targetPath = this.targetPath // 复制目标路径
    log.verbose('templatePath', templatePath)
    log.verbose('targetPath', targetPath)
    fse.ensureDirSync(templatePath)
    fse.ensureDirSync(targetPath)
    fse.copySync(templatePath, targetPath)
    // ejs渲染
    await this.ejsRender({ ignore: this.pageTemplate.ignore, targetPath })
    await this.dependenciesMerge({ targetPath, templatePath })
    log.success('安装页面模板成功')
  }

  async ejsRender({ ignore, targetPath }) {
    try {
      const files = await glob('**', {
        cwd: targetPath,
        ignore,
        nodir: true
      })
      return Promise.all(
        files.map(file => {
          const filePath = path.join(targetPath, file)
          return new Promise((resolve, reject) => {
            ejs.renderFile(
              filePath,
              { name: this.pageTemplate.pageName },
              (err, res) => {
                if (err) {
                  reject(err)
                } else {
                  fs.writeFileSync(filePath, res)
                  resolve(res)
                }
              }
            )
          })
        })
      ).catch(e => log.error(e.message))
    } catch (error) {
      throw new Error(error.message)
    }
  }

  async dependenciesMerge({ targetPath, templatePath }) {
    const templatePkgPath = pkgUp.sync({ cwd: templatePath })
    const targetPkgPath = pkgUp.sync({ cwd: targetPath })
    const templatePkg = fse.readJSONSync(templatePkgPath)
    const targetPkg = fse.readJSONSync(targetPkgPath)
    const templateDep = templatePkg.dependencies || {}
    const targetDep = targetPkg.dependencies || {}
    // 比较两个依赖差别
    const templateDepArr = obj2Array(templateDep)
    const targetDepArr = obj2Array(targetDep)
    const finalDep = depDiff(templateDepArr, targetDepArr)
    targetPkg.dependencies = this.array2Obj(finalDep)
    fse.writeJSONSync(targetPkgPath, targetPkg, { spaces: 2 })
    // 自动安装依赖
    log.info('正在安装页面模板的依赖')
    await this.execCommand('npm install', path.dirname(targetPkgPath))
    log.success('正在页面模板依赖成功')
    function obj2Array(o) {
      const arr = []
      Object.keys(o).forEach(key => {
        arr.push({
          key,
          value: o[key]
        })
      })
      return arr
    }
    function depDiff(templateDepArr, targetDepArr) {
      let finalDep = [...targetDepArr]
      // 模板中存在依赖，项目中不存在
      // 模板中存在依赖，项目中也存在，不拷贝但提示用户
      templateDepArr.forEach(templateDep => {
        const duplicatedDep = targetDepArr.find(
          targetDep => targetDep.key === templateDep.key
        )
        if (duplicatedDep) {
          const templateRange = semver
            .validRange(templateDep.value)
            .split('<')[1]
          const targetRange = semver
            .validRange(duplicatedDep.value)
            .split('<')[1]
          if (templateRange !== targetRange) {
            log.warn(
              `${templateDep.key}'冲突, ${templateDep.value} => ${duplicatedDep.value}`
            )
          }
        } else {
          // 需要合并到targetPkgPath的key
          finalDep.push(templateDep)
        }
      })
      return finalDep
    }
  }

  async execCommand(command, cwd) {
    let res
    if (command) {
      const cmdArr = command.split(' ')
      const cmd = cmdArr[0]
      const args = cmdArr.slice(1)
      res = await spawnAsync(cmd, args, {
        stdio: 'inherit',
        cwd
      })
      if (res != 0) {
        throw new Error(command + '命令执行失败!')
      }
      return res
    }
  }

  array2Obj(arr) {
    const o = {}
    arr.forEach(item => (o[item.key] = item.value))
    return o
  }

  async getPageTemplate() {
    const pageTemplateName = (
      await inquirer.prompt({
        type: 'list',
        name: 'pageTemplate',
        message: '请选择页面模板',
        choices: this.createChoices()
      })
    ).pageTemplate
    const pageTemplate = PAGE_TEMPLATE.find(
      item => item.npmName === pageTemplateName
    )
    if (!pageTemplate) throw new Error('页面模板不存在!')
    const pageName = (
      await inquirer.prompt({
        type: 'input',
        name: 'pageName',
        message: '请输入页面的名称',
        default: '',
        validate(value) {
          const done = this.async()
          if (!value || !value.trim()) {
            done('请输入页面名称')
            return
          }
          done(null, true)
        }
      })
    ).pageName
    pageTemplate.pageName = pageName
    return pageTemplate
  }

  async downloadTemplate() {
    const targetPath = path.resolve(homedir(), '.strive-cli', 'template')
    const storeDir = path.resolve(targetPath, 'node_modules')
    const { npmName, version } = this.pageTemplate
    const pageTemplatePkg = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version
    })
    this.pageTemplatePkg = pageTemplatePkg
    if (!(await pageTemplatePkg.exists(true))) {
      const spinner = spinnerStart('正在下载页面模板')
      await sleep()
      try {
        await pageTemplatePkg.install()
      } catch (error) {
        throw new Error(error.message)
      } finally {
        spinner.stop(true)
        if (await pageTemplatePkg.exists()) {
          log.success('下载页面模板成功')
        }
      }
    }
  }

  async prepare() {
    // 最终拷贝路径
    this.targetPath = path.resolve(this.dir, this.pageTemplate.pageName)
    if (await pathExists(this.targetPath)) {
      throw new Error('页面文件夹已存在')
    }
  }

  createChoices() {
    return PAGE_TEMPLATE.map(item => {
      return {
        name: item.name,
        value: item.npmName
      }
    })
  }
}
const init = argv => {
  return new AddCommand(argv)
}
process.on('unhandledRejection', e => {})
module.exports = init
module.exports.AddCommand = AddCommand
