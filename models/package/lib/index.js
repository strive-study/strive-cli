const path = require('path')
const pathExists = require('path-exists').sync
const fse = require('fs-extra')
const npminstall = require('npminstall')
const pkgDir = require('pkg-dir').sync
const semver = require('semver')
const inquirer = require('inquirer')
const log = require('@strive-cli/log')
const { isObject } = require('@strive-cli/utils')
const { getDefaultRegistry, getNpmInfo } = require('@strive-cli/get-npm-info')
const formatPath = require('@strive-cli/format-path')

class Package {
  constructor(options) {
    if (!options) {
      throw new Error('Package类的options不能为空!')
    }
    if (!isObject(options)) {
      throw new Error('Package类的options必须为对象!')
    }
    this.targetPath = options.targetPath
    // 最终package路径 node_modules
    this.storeDir = options.storeDir
    this.packageName = options.packageName
    this.packageVersion = options.packageVersion
    // this.cacheFilePathPrefix = this.packageName.replace('/', '_')
  }

  async exists(checkVersion = false) {
    if (this.storeDir) {
      // 缓存模式 未指定targetPath
      await this.prepare()
      // publish命令无需检查版本
      if (!checkVersion) {
        return pathExists(this.cacheFilePath)
      } else {
        const isExists = pathExists(this.cacheFilePath)
        if (isExists) {
          const pkgPath = path.resolve(this.cacheFilePath, 'package.json')
          const pkg = fse.readJSONSync(pkgPath)
          if (semver.gt(this.packageVersion, pkg.version)) {
            const update = (
              await inquirer.prompt({
                type: 'list',
                message: '当前模板不是最新版, 是否更新最新版模板?',
                choices: [
                  { name: '是', value: true },
                  { name: '否', value: false }
                ],
                name: 'update'
              })
            ).update
            if (update) {
              return false
            } else {
              return pathExists(this.cacheFilePath)
            }
          } else {
            return pathExists(this.cacheFilePath)
          }
        }
      }
    } else {
      return pathExists(this.targetPath)
    }
  }

  async prepare() {
    // if (this.storeDir && !pathExists(this.storeDir)) {
    //   fse.mkdirpSync(this.storeDir)
    // }

    if (this.packageVersion === 'latest') {
      const res = await getNpmInfo(this.packageName)
      this.packageVersion = res['dist-tags'].latest
    }
  }

  async install() {
    await this.prepare()
    return npminstall({
      root: this.targetPath,
      storeDir: this.storeDir,
      registry: getDefaultRegistry(),
      pkgs: [{ name: this.packageName, version: this.packageVersion }]
    })
  }
  get cacheFilePath() {
    // npminstall 旧版本
    // @strive-cli/init -->  _@strive-cli_init@1.1.2@@strive-cli
    // return path.resolve(
    //   this.storeDir,
    //   `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`
    // )

    // 新版本 参考pnpm修改
    return path.resolve(this.storeDir, this.packageName)
  }
  // async update() {
  //   await this.prepare()
  //   //  下面代码在新版本中基本可以删除了
  //   const res = await getNpmInfo(this.packageName)
  //   const latest = res['dist-tags'].latest
  //   const latestFilePath = this.getSpecificCacheFilePath(latest)
  //   if (!pathExists(latestFilePath)) {
  //     await npminstall({
  //       root: this.targetPath,
  //       storeDir: this.storeDir,
  //       registry: getDefaultRegistry(),
  //       pkgs: [{ name: this.packageName, version: latest }]
  //     })
  //     this.packageVersion = latest
  //   }
  // }

  // getSpecificCacheFilePath(version) {
  //   return path.resolve(
  //     this.storeDir,
  //     `_${this.cacheFilePathPrefix}@${version}@${this.packageName}`
  //   )
  // }

  getRootFilePath() {
    function _getRootFile(targetPath) {
      const dir = pkgDir(targetPath)
      if (dir) {
        const pkg = require(path.join(dir, 'package.json'))
        if (pkg && pkg.main) {
          return formatPath(path.resolve(dir, pkg.main))
        }
      }
      return null
    }
    if (this.storeDir) {
      // 使用缓存
      return _getRootFile(this.cacheFilePath)
    } else {
      // 输入 targetPath
      return _getRootFile(this.targetPath)
    }
  }
}

module.exports = Package
