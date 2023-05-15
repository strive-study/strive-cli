const log = require('@strive-cli/log')
const Package = require('@strive-cli/package')

const settings = {
  init: '@strive-cli/init' //多init包
}

function exec(projectName, options, cwdObj) {
  let targetPath = process.env.CLI_TARGET_PATH
  const homePath = process.env.CLI_HOME_PATH
  const command = cwdObj.name()
  const packageName = settings[command]
  const packageVersion = 'latest'

  log.verbose('exec', projectName, options, command)
  log.verbose('exec', `targetPath==>${targetPath}`)
  log.verbose('exec', `homePath==>${homePath}`)

  if (!targetPath) {
    // 生产缓存路径
    targetPath = ''
  }

  const pkg = new Package({
    targetPath,
    packageName,
    packageVersion
  })
  console.log('rootFilePath==>', pkg.getRootFilePath())
}

module.exports = exec
