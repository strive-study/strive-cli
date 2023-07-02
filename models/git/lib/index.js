const path = require('path')
const { homedir } = require('os')
const fse = require('fs-extra')
const SimpleGit = require('simple-git')
const log = require('@strive-cli/log')
const { readFile, writeFile, spinnerStart } = require('@strive-cli/utils')
const terminalLink = require('terminal-link')
const inquirer = require('inquirer')
const GitHub = require('./github')
const Gitee = require('./gitee')
const template = require('./gitignore')

const DEFAULT_CLI_HOME = '.strive-cli'
const GIT_ROOT_DIR = '.git'
const GIT_SERVER_FILE = '.git_server' // 存储使用的git平台
const GIT_TOKEN_FILE = '.git_token' //存储git token
const GIT_OWNER_FILE = '.git_owner' //个人or组织
const GIT_LOGIN_FILE = '.git_login' //登录用户名 个人 or 组织名
const GIT_IGNORE_FILE = '.gitignore' //gitignore
const GITHUB = 'github'
const GITEE = 'gitee'
const REPO_OWNER_USER = 'user'
const REPO_OWNER_ORG = 'org'
const GIT_SERVER_TYPE = [
  {
    name: 'Github',
    value: GITHUB
  },
  {
    name: 'Gitee',
    value: GITEE
  }
]
const GIT_OWNER_TYPE = [
  {
    name: '个人',
    value: REPO_OWNER_USER
  },
  {
    name: '组织',
    value: REPO_OWNER_ORG
  }
]
const GIT_OWNER_TYPE_ONLY = [
  {
    name: '个人',
    value: REPO_OWNER_USER
  }
]

class Git {
  constructor(
    { name, version, dir },
    { refreshServer = false, refreshToken = false, refreshOwner = false }
  ) {
    this.name = name // 项目名称
    this.version = version
    this.dir = dir // 项目源码目录
    this.git = SimpleGit(dir)
    this.gitServer = null
    this.homePath = null // 本地缓存目录
    this.user = null // 用户信息
    this.orgs = null // 用户所属组织列表
    this.owner = null // 远程仓库所属类型
    this.login = null // 远程仓库登录名
    this.repo = null // 远程仓库信息
    this.refreshServer = refreshServer // 是否强制刷新远程仓库
    this.refreshToken = refreshToken // 是否强制刷新远程仓库token
    this.refreshOwner = refreshOwner // 是否强制刷新远程仓库所属类型
  }

  async prepare() {
    this.checkHomePath() // check 缓存主目录
    await this.checkGitServer() // 检查用户远程仓库类型
    await this.checkGitToken() // 获取远程仓库token
    await this.getUserAndOrg() // 获取远程仓库用户和组织信息
    await this.checkGitOwner() // 确认远程仓库类型
    await this.checkRepo() // 检查并创建远程仓库
    this.checkGitignore() // 检查并创建 .gitignore
    await this.init() // 初始化本地仓库 .git
  }

  async init() {
    if (await this.getRemote()) {
      return
    }
    await this.initAndAddRemote()
    await this.initCommit()
  }

  async initCommit() {
    await this.checkConflicted()
    await this.checkNotCommitted()
    if (await this.checkRemoteMaster()) {
      await this.pullRemoteRepo('master', {
        '--allow-unrelated-histories': null
      })
    } else {
      await this.pushRemoteRepo('master')
    }
  }

  async pullRemoteRepo(branchName, options) {
    log.info(`同步远程${branchName}分支代码`)
    await this.git.pull('origin', branchName, options).catch(err => {
      log.error(err.message)
    })
  }

  async pushRemoteRepo(branchName) {
    log.info(`推送代码至${branchName}分支`)
    await this.git.push('origin', branchName)
    log.success('推送代码成功')
  }

  async checkRemoteMaster() {
    return (
      (await this.git.listRemote(['--refs'])).indexOf('refs/heads/master') >= 0
    )
  }

  async checkConflicted() {
    log.info('代码冲突检查')
    const status = await this.git.status()
    console.log(status)
    if (status.conflicted.length > 0) {
      throw new Error('当前代码存在冲突, 请手动处理合并后再试！')
    }
    log.success('代码冲突检查通过')
  }

  async checkNotCommitted() {
    const status = await this.git.status()
    if (
      status.not_added.length > 0 ||
      status.created.length > 0 ||
      status.deleted.length > 0 ||
      status.modified.length > 0 ||
      status.renamed.length > 0
    ) {
      await this.git.add(status.not_added)
      await this.git.add(status.created)
      await this.git.add(status.deleted)
      await this.git.add(status.modified)
      await this.git.add(status.renamed)
      let message
      while (!message) {
        message = (
          await inquirer.prompt({
            type: 'text',
            name: 'message',
            message: '请输入commit信息'
          })
        ).message
      }
      await this.git.commit(message)
      log.success('本地commit提交成功')
    }
  }

  async getRemote() {
    const gitPath = path.resolve(this.dir, GIT_ROOT_DIR)
    this.remote = this.gitServer.getRemote(this.login, this.name)
    if (fs.existsSync(gitPath)) {
      log.success('git已完成初始化')
      return true
    }
  }

  async initAndAddRemote() {
    log.info('执行 git 初始化')
    await this.git.init(this.dir)
    log.info('添加git remote')
    const remotes = await this.git.getRemotes()
    log.verbose('git remotes', remotes)
    if (!remotes.find(remote => remote.name === 'origin')) {
      await this.git.addRemote('origin', this.remote)
    }
  }

  checkGitignore() {
    const gitignore = path.resolve(this.dir, GIT_IGNORE_FILE)
    if (!fs.existsSync(gitignore)) {
      writeFile(gitignore, template)
      log.success(`自动写入${GIT_IGNORE_FILE}文件成功`)
    }
  }

  checkHomePath() {
    if (!this.homePath) {
      if (process.env.ClI_HOME_PATH) {
        this.homePath = process.env.ClI_HOME_PATH
      } else {
        this.homePath = path.resolve(homedir(), DEFAULT_CLI_HOME)
      }
    }
    log.verbose('home', this.homePath)
    fse.ensureDirSync(this.homePath)
  }

  createPath(file) {
    const rootDir = path.resolve(this.homePath, GIT_ROOT_DIR)
    const filePath = path.resolve(rootDir, file)
    fse.ensureDirSync(rootDir)
    return filePath
  }

  /**
   * 创建对应git类型
   * @param {*} gitServer
   */
  createGitServer(gitServer) {
    gitServer = gitServer.trim()
    if (gitServer === GITHUB) {
      return new GitHub()
    } else if (gitServer === GITEE) {
      return new Gitee()
    }
    return null
  }

  async checkGitServer() {
    const gitServerPath = this.createPath(GIT_SERVER_FILE)
    let gitServer = readFile(gitServerPath) // github or gitee
    if (!gitServer || this.refreshServer) {
      gitServer = (
        await inquirer.prompt({
          type: 'list',
          name: 'gitServer',
          message: '请选择托管的Git平台',
          default: GITHUB,
          choices: GIT_SERVER_TYPE
        })
      ).gitServer
      writeFile(gitServerPath, gitServer)
      log.success('git server写入成功', `${gitServer} -> ${gitServerPath}`)
    } else {
      log.success('git server获取成功', gitServer)
    }
    this.gitServer = this.createGitServer(gitServer)
    if (!this.gitServer) throw new Error('GitServer初始化失败！')
  }

  async checkGitToken() {
    const tokenPath = this.createPath(GIT_TOKEN_FILE)
    let token = readFile(tokenPath)
    if (!token || this.refreshToken) {
      log.warn(
        `${this.gitServer.type} token未生成,请先生成${
          this.gitServer.type
        } token, ${terminalLink('链接', this.gitServer.getTokenUrl())}
      `
      )
      token = (
        await inquirer.prompt({
          type: 'password',
          name: 'token',
          message: '请将token复制到这里',
          default: ''
        })
      ).token
      writeFile(tokenPath, token)
      log.success('token写入成功', `${token} -> ${tokenPath}`)
    } else {
      log.success('token获取成功', tokenPath)
    }
    this.token = token
    this.gitServer.setToken(token)
  }

  async getUserAndOrg() {
    this.user = await this.gitServer.getUser()
    if (!this.user) throw new Error('用户信息获取失败')
    this.orgs = await this.gitServer.getOrg(this.user.login)
    if (!this.orgs) throw new Error('组织信息获取失败')
    log.success(this.gitServer.type + '用户和组织信息获取成功')
  }

  async checkGitOwner() {
    const ownerPath = this.createPath(GIT_OWNER_FILE)
    const loginPath = this.createPath(GIT_LOGIN_FILE)
    let owner = readFile(ownerPath)
    let login = readFile(loginPath)
    if (!owner || !login || this.refreshOwner) {
      owner = (
        await inquirer.prompt({
          type: 'list',
          name: 'owner',
          message: '请选择远程仓库类型',
          default: REPO_OWNER_USER,
          choices: this.orgs.length > 0 ? GIT_OWNER_TYPE : GIT_OWNER_TYPE_ONLY
        })
      ).owner
      if (owner === REPO_OWNER_USER) {
        login = this.user.login
      } else {
        login = (
          await inquirer.prompt({
            type: 'list',
            name: 'login',
            message: '请选择',
            default: '',
            choices: this.orgs.map(item => ({
              name: item.login,
              value: item.login
            }))
          })
        ).login
      }
      writeFile(ownerPath, owner)
      writeFile(loginPath, login)
      log.success('owner写入成功', `${owner} -> ${ownerPath}`)
      log.success('login写入成功', `${login} -> ${loginPath}`)
    } else {
      log.success('owner获取成功')
      log.success('login获取成功')
    }
    this.owner = owner
    this.login = login
  }

  async checkRepo() {
    let repo = await this.gitServer.getRepo(this.login, this.name)
    if (!repo) {
      let spinner = spinnerStart('开始创建远程仓库...')
      try {
        if (this.owner === REPO_OWNER_USER) {
          repo = await this.gitServer.createRepo(this.name)
        } else {
          repo = await this.gitServer.createOrgRepo(this.name, this.login)
        }
      } catch (error) {
        console.log('创建失败', error)
      } finally {
        spinner.stop(true)
      }
      if (repo) {
        log.success('远程仓库创建成功')
      } else {
        throw new Error('远程仓库创建失败')
      }
    } else {
      log.success('远程仓库信息获取成功')
    }
    this.repo = repo
  }
}
module.exports = Git
