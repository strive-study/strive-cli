const { homedir } = require('os')
const path = require('path')
const semver = require('semver')
const colors = require('colors')
const rootCheck = require('root-check')
const pathExists = require('path-exists').sync
const dotenv = require('dotenv')
const commander = require('commander')
let log = require('@strive-cli/log')
const init = require('@strive-cli/init')
const exec = require('@strive-cli/exec')
const pkg = require('../package.json')
const { getNpmInfo } = require('@strive-cli/get-npm-info')
const { DEFAULT_CLI_HOME } = require('./const')

let args
// let log
let config
let program = new commander.Command()
const userHome = homedir()
const core = async () => {
  try {
    prepare()
    // 注册命令
    registerCommand()
  } catch (e) {
    log.error(e.message)
    if (program.opts().debug) {
      log.error(e)
    }
  }
}
const prepare = async () => {
  checkPkgVersion()
  // checkNodeVersion()
  rootCheck()
  checkUserHome()
  checkEnv()
  await checkGlobalUpdate()
}

const checkPkgVersion = () => {
  log.notice('version', pkg.version)
  log.success('test', 'success')
}

// const checkNodeVersion = () => {
//   const nodeVersion = process.version
//   if (!semver.gte(nodeVersion, LOWEST_NODE_VERSION)) {
//     throw new Error(
//       colors.red(`strive-cli 需要使用 v${LOWEST_NODE_VERSION} 以上的版本`)
//     )
//   }
// }

const checkUserHome = () => {
  if (!userHome || !pathExists(userHome))
    throw new Error(colors.red('当前用户主目录不存在！'))
}

const checkEnv = () => {
  const envPath = path.resolve(userHome, '.env')

  if (pathExists(envPath)) {
    dotenv.config({ path: envPath })
  }
  createDefault()
}

const createDefault = () => {
  const cliConfig = {
    home: userHome
  }
  if (process.env.CLI_HOME) {
    cliConfig.cliHome = path.join(userHome, process.env.CLI_HOME)
  } else {
    cliConfig.cliHome = path.join(userHome, DEFAULT_CLI_HOME)
  }
  process.env.CLI_HOME_PATH = cliConfig.cliHome
}

const checkGlobalUpdate = async () => {
  const curVersion = pkg.version
  const npmName = pkg.name
  const res = await getNpmInfo(npmName)
  if (res) {
    const latest = res['dist-tags'].latest
    if (semver.gt(latest, curVersion)) {
      log.warn(
        '更新提示',
        colors.yellow(`检测倒${npmName}有最新版本! v${latest}
执行 npm install -g ${npmName} 更新!`)
      )
    }
  }
}

const registerCommand = () => {
  program
    .name(Object.keys(pkg.bin)[0])
    .usage('<command> [options]')
    .version(pkg.version)
    .option('-d, --debug', '是否开启调试模式', false)
    .option('-tp, --targetPath <targetPath>', '是否指定本地调试文件路径', '')

  program
    .command('init [projectName]')
    .option('-f, --force', '是否强制初始化项目', false)
    // .action(init)
    .action(exec)

  program
    .command('publish')
    .option('--refreshServer', '强制更新远程Git仓库')
    .option('--refreshToken', '强制更新远程仓库Token')
    .option('--refreshOwner', '强制更新远程仓库所属类型')
    .option('--buildCmd [buildCmd]', '构建命令型') // windows <> bug -> []代替
    .option('--prod', '是否正式发布') // windows <> bug -> []代替
    .action(exec)

  program.on('option:debug', () => {
    if (program.opts().debug) {
      process.env.LOG_LEVEL = 'verbose'
    } else {
      process.env.LOG_LEVEL = 'info'
    }
    log.level = process.env.LOG_LEVEL
  })

  program.on('option:targetPath', () => {
    if (program.opts().targetPath) {
      process.env.CLI_TARGET_PATH = program.opts().targetPath
    }
  })

  program.on('command:*', cmds => {
    const availableCommands = program.commands.map(cmd => cmd.name())
    console.log(colors.red(`未知的命令！${cmds[0]}`))
    if (availableCommands.length) {
      console.log(colors.red(`可用命令：${availableCommands.join(',')}`))
    }
  })

  program.parse(process.argv)

  // strive -d 等无子命令的行为 均无效行为 也需要打印帮助文档
  if (program?.args.length < 1) {
    program.outputHelp()
    console.log() //空一行
  }
}
module.exports = core
