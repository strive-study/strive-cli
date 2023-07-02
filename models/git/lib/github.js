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

  createRepo() {}

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
}

module.exports = GitHub
