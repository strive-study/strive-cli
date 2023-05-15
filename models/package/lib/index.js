const path = require('path')
const pkgDir = require('pkg-dir').sync
const log = require('@strive-cli/log')
const { isObject } = require('@strive-cli/utils')
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
    this.packageName = options.packageName
    this.packageVersion = options.packageVersion
    console.log('package... 实例化')
  }

  exists() {}

  install() {}

  update() {}

  getRootFilePath() {
    const dir = pkgDir(this.targetPath)
    if (dir) {
      const pkg = require(path.join(dir, 'package.json'))
      if (pkg && pkg.main) {
        return formatPath(path.resolve(dir, pkg.main))
      }
    }
    return null
  }
}

module.exports = Package
