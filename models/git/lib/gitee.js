const GitServer = require('./gitServer')
const GiteeRequest = require('./giteeRequest')
class Gitee extends GitServer {
  constructor() {
    super('gitee')
    this.request = null
  }

  setToken(token) {
    super.setToken(token)
    this.request = new GiteeRequest(token)
  }

  createRepo() {}

  createOrgRepo() {}

  getRemote() {}

  getUser() {
    return this.request.get('/user')
  }

  getOrg(username) {
    return this.request.get(`/users/${username}/orgs`, {
      page: 1,
      per_page: 100
    })
  }

  getTokenHelpUrl() {
    return 'https://gitee.com/profile/sshkeys'
  }

  getSSHKeyUrl() {
    return 'https://help.gitee.com/base/account/SSH%E5%85%AC%E9%92%A5%E8%AE%BE%E7%BD%AE'
  }
}

module.exports = Gitee
