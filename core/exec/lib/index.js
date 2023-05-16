const path = require('path')
const log = require('@strive-cli/log')
const Package = require('@strive-cli/package')

const settings = {
  init: '@strive-cli/init' //多init包
}

const CACHE_DIR = 'dependencies'

async function exec(projectName, options, cwdObj) {
  let targetPath = process.env.CLI_TARGET_PATH
  const homePath = process.env.CLI_HOME_PATH
  let storeDir = ''
  let pkg
  const command = cwdObj.name()
  const packageName = settings[command]
  const packageVersion = 'latest'
  // const packageVersion = '1.0.1' //test

  log.verbose('exec', projectName, options, command)
  log.verbose('exec', `targetPath==>${targetPath}`)
  log.verbose('exec', `homePath==>${homePath}`)

  if (!targetPath) {
    // 生成缓存路径
    targetPath = path.resolve(homePath, CACHE_DIR)
    storeDir = path.resolve(targetPath, 'node_modules')
    log.verbose('没有targetPath', targetPath, storeDir)

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
    // new
    if (!(await pkg.exists())) {
      log.verbose('包不存在执行安装')
      await pkg.install()
    }
  } else {
    pkg = new Package({
      targetPath,
      packageName,
      packageVersion
    })
  }
  console.log('rootFilePath==>', pkg.getRootFilePath())
  const rootFile = pkg.getRootFilePath()
  if (rootFile) {
    require(rootFile).apply(null, arguments)
  }
}

module.exports = exec
