const path = require('path')
const log = require('@strive-cli/log')
const Package = require('@strive-cli/package')
const { spawn } = require('@strive-cli/utils')

const settings = {
  init: '@strive-cli/init', //多init包
  publish: '@strive-cli/publish'
}

const CACHE_DIR = 'dependencies'

async function exec() {
  let targetPath = process.env.CLI_TARGET_PATH
  const homePath = process.env.CLI_HOME_PATH
  let storeDir = ''
  let pkg
  const args = Array.from(arguments)
  const cmd = args[args.length - 1]

  const command = cmd.name()
  const packageName = settings[command]
  const packageVersion = 'latest'
  // --targetPath
  if (!targetPath) {
    // 生成缓存路径
    targetPath = path.resolve(homePath, CACHE_DIR)
    storeDir = path.resolve(targetPath, 'node_modules')
    pkg = new Package({
      targetPath,
      storeDir,
      packageName,
      packageVersion
    })
    // if (await pkg.exists()) {
    //   // update package
    //   console.log('update')
    //   await pkg.update()
    // } else {
    //   await pkg.install()
    //   // install package
    // }
    // 使用远程command包, 需要本地缓存一份
    if (!(await pkg.exists())) {
      await pkg.install()
    }
  } else {
    pkg = new Package({
      targetPath,
      packageName,
      packageVersion
    })
  }
  const rootFile = pkg.getRootFilePath()
  if (rootFile) {
    try {
      const o = Object.create(null)
      Object.keys(cmd).forEach(key => {
        if (
          cmd.hasOwnProperty(key) &&
          !key.startsWith('_') &&
          key !== 'parent'
        ) {
          o[key] = cmd[key]
        }
      })
      // 模拟opts函数
      const options = cmd.opts()
      o.opts = options

      args[args.length - 1] = o
      log.verbose('args', args)
      const code = `require('${rootFile}').call(null, ${JSON.stringify(args)})`
      const child = spawn('node', ['-e', code], {
        cwd: process.cwd(),
        stdio: 'inherit'
      })

      child.on('exit', e => {
        log.verbose('命令执行成功!' + e)
        process.exit(e)
      })

      child.on('error', e => {
        log.error(e.message)
        process.exit(1)
      })
    } catch (e) {
      log.error(e.message)
    }
  }
}

module.exports = exec
