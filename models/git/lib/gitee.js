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

  createRepo(name) {
    return this.request.post('/user/repos', {
      name
    })
  }

  createOrgRepo(name, org) {
    return this.request.post(`/orgs/${org}/repos`, {
      name
    })
  }

  getUser() {
    return this.request.get('/user')
  }

  getOrg(username) {
    return this.request.get(`/users/${username}/orgs`, {
      page: 1,
      per_page: 100
    })
  }

  getRepo(login, name) {
    return this.request.get(`/repos/${login}/${name}`).then(res => {
      return this.handleRes(res)
    })
  }

  getTokenUrl() {
    return 'https://gitee.com/profile/personal_access_tokens'
  }

  getSSHKeyUrl() {
    return 'https://help.gitee.com/base/account/SSH%E5%85%AC%E9%92%A5%E8%AE%BE%E7%BD%AE'
  }

  handleRes = res => {
    // 404
    if ('message' in res) {
      return null
    }
    return res
  }

  getRemote(login, name) {
    return `git@gitee.com:${login}/${name}.git`
  }
}

module.exports = Gitee
