const GitServer = require('./gitServer')

class GitHub extends GitServer {
  constructor() {
    super('github')
  }

  setToken() {}

  createRepo() {}

  createOrgRepo() {}

  getRemote() {}

  getUser() {}

  getOrg() {}

  getTokenHelpUrl() {
    return 'https://github.com/settings/keys'
  }

  getSSHKeyUrl() {
    return 'https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent'
  }
}

module.exports = GitHub
