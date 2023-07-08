const path = require('path')
const { homedir } = require('os')
const cp = require('child_process')
const fse = require('fs-extra')
const SimpleGit = require('simple-git')
const log = require('@strive-cli/log')
const { readFile, writeFile, spinnerStart } = require('@strive-cli/utils')
const request = require('@strive-cli/request')
const CloudBuild = require('@strive-cli/cloudbuild')
const terminalLink = require('terminal-link')
const semver = require('semver')
const inquirer = require('inquirer')
const Listr = require('listr')
const { Observable } = require('rxjs')
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
const GIT_PUBLISH_FILE = '.git_publish' // 发布云服务平台 OSS or other
const TEMPLATE_TEMP_DIR = 'oss'
const GITHUB = 'github'
const GITEE = 'gitee'
const REPO_OWNER_USER = 'user'
const REPO_OWNER_ORG = 'org'
const VERSION_RELEASE = 'release'
const VERSION_DEV = 'dev'
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
const GIT_PUBLISH_TYPE = [
  {
    name: 'OSS',
    value: 'oss'
  }
]

class Git {
  constructor(
    { name, version, dir }, // projectInfo
    {
      refreshServer = false,
      refreshToken = false,
      refreshOwner = false,
      buildCmd = '',
      prod = false,
      sshUser = '',
      sshIp = '',
      sshPath = ''
    }
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
    this.branch = null // 本地开发分支
    this.refreshServer = refreshServer // 是否强制刷新远程仓库
    this.refreshToken = refreshToken // 是否强制刷新远程仓库token
    this.refreshOwner = refreshOwner // 是否强制刷新远程仓库所属类型
    this.buildCmd = buildCmd // 云构建命令
    this.gitPublish = null //静态资源服务器类型
    this.prod = prod // 是否正式发布
    this.sshUser = sshUser
    this.sshIp = sshIp
    this.sshPath = sshPath
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

  async commit() {
    // 生成开发分支
    await this.getCorrectVersion()
    // 检查stash区
    await this.checkStash()
    // 检查代码冲突
    await this.checkConflicted()
    // 检查未提交代码
    await this.checkNotCommitted()
    // 切换开发分支
    await this.checkoutBranch(this.branch)
    // 合并远程master分支和开发分支代码到本地开发分支
    await this.pullRemoteMasterAndBranch()
    // 将开发分支推送到远程仓库
    await this.pushRemoteRepo(this.branch)
  }

  async publish() {
    await this.preparePublish()
    const cloudBuild = new CloudBuild(this, {
      buildCmd: this.buildCmd,
      type: this.gitPublish,
      prod: this.prod
    })
    await cloudBuild.prepare()
    await cloudBuild.init()
    const res = await cloudBuild.build()
    if (res) {
      await this.uploadTemplate()
    }
    if (this.prod && res) {
      // 打tag
      await this.runTask()
    }
  }

  async runTask() {
    // await this.checkTag() // 打tag
    // await this.checkoutBranch('master') // 切换分支到master
    // await this.mergeBranchToMaster() // 开发分支代码合并到master分支
    // await this.pushRemoteRepo('master') // 代码推送到远程master
    // await this.deleteLocalBranch() // 删除本地开发分支
    // await this.deleteRemoteBranch() // 删除远程开发分支
    const tasks = new Listr([
      {
        title: '自动生成远程仓库Tag',
        task: () =>
          new Listr([
            {
              title: '创建Tag',
              task: () => {
                return new Observable(async observer => {
                  observer.next('正在创建Tag')
                  await this.checkTag()
                  observer.complete()
                })
              }
            },
            {
              title: '切换分支到Master',
              task: () => {
                return new Observable(async observer => {
                  observer.next('正在切换Master分支')
                  await this.checkoutBranch('master')
                  observer.complete()
                })
              }
            },
            {
              title: '开发分支代码合并到Master分支',
              task: () => {
                return new Observable(async observer => {
                  observer.next('正在合并到master分支')
                  await this.mergeBranchToMaster()
                  observer.complete()
                })
              }
            },
            {
              title: '代码推送到远程Master',
              task: () => {
                return new Observable(async observer => {
                  observer.next('正在推送到Master分支')
                  await this.pushRemoteRepo('master')
                  observer.complete()
                })
              }
            },
            {
              title: '删除本地开发分支',
              task: () => {
                return new Observable(async observer => {
                  observer.next('正在删除本地开发分支')
                  await this.deleteLocalBranch()
                  observer.complete()
                })
              }
            },
            {
              title: '删除远程开发分支',
              task: () => {
                return new Observable(async observer => {
                  observer.next('正在删除远程开发分支')
                  await this.deleteRemoteBranch()
                  observer.complete()
                })
              }
            }
          ])
      }
    ])
    tasks.run()
  }

  async mergeBranchToMaster() {
    // log.info('开始合并代码', `[${this.branch}] -> [master]`)
    await this.git.mergeFromTo(this.branch, 'master')
    // log.success('代码合并成功', `[${this.branch}] -> [master]`)
  }

  async deleteLocalBranch() {
    // log.info('开始删除本地开发分支', this.branch)
    await this.git.deleteLocalBranch(this.branch)
    // log.success('删除本地开发分支成功', this.branch)
  }

  async deleteRemoteBranch() {
    // log.info('开始删除远程开发分支', this.branch)
    await this.git.push(['origin', '--delete', this.branch])
    // log.success('删除远程开发分支成功', this.branch)
  }

  async checkTag() {
    // log.info('获取远程tag列表')
    const tag = `${VERSION_RELEASE}/${this.version}`
    const tagList = await this.getRemoteBranchList(VERSION_RELEASE)
    if (tagList.includes(this.version)) {
      // log.info('远程tag已存在', tag)
      // 删除远程tag
      await this.git.push(['origin', `:refs/tags/${tag}`])
      // log.success('远程tag已删除', tag)
    }
    // 删除本地tag
    const localTagList = await this.git.tags()
    if (localTagList.all.includes(tag)) {
      // log.info('本地tag已存在', tag)
      await this.git.tag(['-d', tag])
      // log.success('本地tag已删除', tag)
    }
    // 重新创建tag
    await this.git.addTag(tag)
    // log.success('本地tag创建成功', tag)
    await this.git.pushTags('origin')
    // log.success('远程tag推送成功', tag)
  }

  async uploadTemplate() {
    log.verbose(this.sshUser, this.sshIp, this.sshPath)
    if (this.sshUser && this.sshIp && this.sshPath) {
      log.info('开始下载模板文件')
      let ossTemplate = await request({
        url: '/oss/file',
        params: {
          name: this.name, // bucket下项目目录名
          type: this.prod ? 'prod' : 'dev',
          file: 'index.html' // 下载文件名
        }
      })
      if (ossTemplate.code === 0 && ossTemplate.data) {
        ossTemplate = ossTemplate.data
      }
      let res = await request({
        url: ossTemplate.url
      })
      if (res) {
        // 模板文件缓存目录
        const ossTempDir = path.resolve(
          this.homePath,
          TEMPLATE_TEMP_DIR,
          `${this.name}@${this.version}`
        )
        fse.ensureDirSync(ossTempDir)
        fse.emptyDirSync(ossTempDir)
        const templateFilePath = path.resolve(ossTempDir, 'index.html')
        fse.createFileSync(templateFilePath)
        fse.writeFileSync(templateFilePath, res)
        log.success('模板文件下载成功', templateFilePath)
        log.info('开始上传模板文件至服务器')
        const uploadCmd = `scp ${templateFilePath} ${this.sshUser}@${this.sshIp}:${this.sshPath}`
        log.verbose('uploadCmd', uploadCmd)
        const ret = cp.execSync(uploadCmd.replace(/\\/g, '/'))
        console.log(ret.toString())
        log.success('模板文件上传成功')
        fse.emptyDirSync(ossTempDir)
      }
    }
  }

  async preparePublish() {
    log.info('开始进行云构建前代码检查')
    const pkg = this.getPackageJson()

    if (this.buildCmd) {
      const cmdArr = this.buildCmd.split(' ')
      if (cmdArr[0] !== 'npm' && cmdArr[0] !== 'cnpm') {
        throw new Error('Build命令非法, 必须使用npm或cnpm')
      }
    } else {
      this.buildCmd = 'npm run build'
    }
    const cmdArr = this.buildCmd.split(' ')
    const lastCmd = cmdArr[cmdArr.length - 1]
    if (!pkg.scripts || !Object.keys(pkg.scripts).includes(lastCmd) < 0) {
      throw new Error(this.buildCmd + '命令不存在')
    }
    log.success('云构建代码预检查通过')
    const gitPublishPath = this.createPath(GIT_PUBLISH_FILE)
    let gitPublish = readFile(gitPublishPath)
    if (!gitPublish) {
      gitPublish = (
        await inquirer.prompt({
          type: 'list',
          name: 'gitPublish',
          choices: GIT_PUBLISH_TYPE,
          message: '请选择您想要上传代码的平台'
        })
      ).gitPublish
      writeFile(gitPublishPath, gitPublish)
      log.success(
        'git publish类型写入成功',
        `${gitPublish} -> ${gitPublishPath}`
      )
    } else {
      log.success('git publish类型获取成功', gitPublish)
    }
    this.gitPublish = gitPublish
  }

  getPackageJson() {
    const pkgPath = path.resolve(this.dir, 'package.json')
    if (!fs.existsSync(pkgPath)) {
      throw new Error('package.json不存在!')
    }
    return fse.readJSONSync(pkgPath)
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
    // log.info(`推送代码至${branchName}分支`)
    await this.git.push('origin', branchName)
    // log.success('推送代码成功')
  }

  async checkRemoteMaster() {
    return (
      (await this.git.listRemote(['--refs'])).indexOf('refs/heads/master') >= 0
    )
  }

  async checkConflicted() {
    log.info('代码冲突检查')
    const status = await this.git.status()
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

  async pullRemoteMasterAndBranch() {
    log.info(`合并 [master] -> [${this.branch}]`)
    await this.pullRemoteRepo('master')
    log.success('合并远程 [master] 分支代码成功')
    await this.checkConflicted()
    log.info('检查远程开发分支')
    const remoteBranchList = await this.getRemoteBranchList()
    if (remoteBranchList.indexOf(this.version) >= 0) {
      // pull
      log.info(`合并 [${this.branch}] -> [${this.branch}]`)
      await this.pullRemoteRepo(this.branch)
      log.success(`合并远程 [${this.branch}] 分支代码成功`)
      await this.checkConflicted()
    } else {
      log.success(`不存在远程分支 [${this.branch}]`)
    }
  }

  async checkoutBranch(branch) {
    const localBranchList = await this.git.branchLocal()
    if (localBranchList.all.indexOf(branch) >= 0) {
      await this.git.checkout(branch)
    } else {
      // 创建分支
      await this.git.checkoutLocalBranch(branch)
    }
    // log.success(`分支切换到${branch}`)
  }

  async checkStash() {
    log.info('检查stash记录')
    const stashList = await this.git.stashList()
    if (stashList.all.length > 0) {
      await this.git.stash(['pop'])
      log.success('stash pop成功')
    }
  }

  async getCorrectVersion() {
    // release/x.y.z   dev/x.y.z
    log.info('获取代码分支')
    const remoteBranchList = await this.getRemoteBranchList(VERSION_RELEASE)
    let releaseVersion = null
    if (remoteBranchList && remoteBranchList.length > 0) {
      releaseVersion = remoteBranchList[0]
    }
    log.verbose('线上最新版本号', releaseVersion)
    // 生成本地开发分支
    const devVersion = this.version
    // 远程无releaseVersion
    if (!releaseVersion) {
      this.branch = `${VERSION_DEV}/${devVersion}`
      // 本地开发分支大于远程分支
    } else if (semver.gt(devVersion, releaseVersion)) {
      log.info('当前版本大于线上最新版本', `${devVersion} > ${releaseVersion}`)
      this.branch = `${VERSION_DEV}/${devVersion}`
    } else {
      log.info('当前线上版本大于本地版本', `${releaseVersion} > ${devVersion}`)
      const incType = (
        await inquirer.prompt({
          type: 'list',
          name: 'incType',
          message: '自动升级版本, 请选择升级版本类型',
          default: 'patch',
          choices: [
            {
              name: `小版本 (${releaseVersion} -> ${semver.inc(
                releaseVersion,
                'patch'
              )})`,
              value: 'patch'
            },
            {
              name: `中版本 (${releaseVersion} -> ${semver.inc(
                releaseVersion,
                'minor'
              )})`,
              value: 'minor'
            },
            {
              name: `大版本 (${releaseVersion} -> ${semver.inc(
                releaseVersion,
                'major'
              )})`,
              value: 'major'
            }
          ]
        })
      ).incType
      const incVersion = semver.inc(releaseVersion, incType)
      this.branch = `${VERSION_DEV}/${incVersion}`
      this.version = incVersion
    }
    log.verbose('本地开发分支', this.branch)
    // 将version同步到package.version
    this.syncVersionToPkgJson()
  }

  syncVersionToPkgJson() {
    const pkg = fse.readJSONSync(`${this.dir}/package.json`)
    if (pkg && pkg.version !== this.version) {
      pkg.version = this.version
      fse.writeJsonSync(`${this.dir}/package.json`, pkg, { spaces: 2 })
    }
  }

  async getRemoteBranchList(type) {
    const remoteList = await this.git.listRemote(['--refs'])
    let reg
    if (type === VERSION_RELEASE) {
      reg = /.+?refs\/tags\/release\/(\d+\.\d+\.\d+)/g
    } else {
      reg = /.+?refs\/heads\/dev\/(\d+\.\d+\.\d+)/g
    }
    return remoteList
      .split('\n')
      .map(remote => {
        const match = reg.exec(remote)
        reg.lastIndex = 0
        if (match && semver.valid(match[1])) {
          return match[1]
        }
      })
      .filter(_ => _)
      .sort((a, b) => {
        if (semver.lte(b, a)) {
          if (a === b) return 0
          return -1
        }
        return 1
      })
  }
}
module.exports = Git
