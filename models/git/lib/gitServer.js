function error(methodName) {
  throw new Error(`${methodName} must be implemented`)
}
/**
 * git仓库实例基类
 */
class GitServer {
  constructor(type, token) {
    this.type = type
    this.token = token
  }

  setToken(token) {
    this.token = token
  }

  createRepo() {
    error('createRepo')
  }

  createOrgRepo(name, org) {
    error('createOrgRepo')
  }

  getRemote() {
    error('getRemote')
  }

  getUser() {
    error('getUser')
  }

  getOrg() {
    error('getOrg')
  }

  getRepo(login, name) {
    error('getRepo')
  }

  getTokenUrl() {
    error('getTokenUrl')
  }

  getSSHKeyUrl() {
    error('getSSHKeysUrl')
  }
}

module.exports = GitServer
