const SimpleGit = require('simple-git')
class Git {
  constructor({ name, version, dir }) {
    this.name = name
    this.version = version
    this.dir = dir
    this.git = SimpleGit(dir)
    this.gitServer = null
  }

  prepare() {}

  init() {
    console.log('git init')
  }
}
module.exports = Git
