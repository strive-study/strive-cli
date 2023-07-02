const GitServer = require('./gitServer')
const GithubRequest = require('./githubRequest')

class GitHub extends GitServer {
  constructor() {
    super('github')
    this.request = null
  }

  setToken(token) {
    super.setToken(token)
    this.request = new GithubRequest(token)
  }
  getRepo(login, name) {
    return this.request.get(`/repos/${login}/${name}`).then(res => {
      console.log('res', res)
      return this.handleRes(res)
    })
  }
  createRepo(name) {
    return this.request.post(
      '/user/repos',
      {
        name
      },
      { 'X-GitHub-Api-Version': '2022-11-28' }
    )
  }

  createOrgRepo() {}

  getRemote() {}

  getUser() {
    return this.request.get(
      '/user',
      {},
      { 'X-GitHub-Api-Version': '2022-11-28' }
    )
  }

  getOrg(username) {
    return this.request.get(
      `/users/${username}/orgs`,
      {
        page: 1,
        per_page: 100
      },
      {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    )
  }

  getTokenUrl() {
    return 'https://github.com/settings/tokens/new'
  }

  getSSHKeyUrl() {
    return 'https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent'
  }

  handleRes = res => {
    if (res.status && res.status === 404) {
      return null
    }
    return res
  }
}

module.exports = GitHub
