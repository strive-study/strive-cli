const axios = require('axios')
const urlJoin = require('url-join')
const semver = require('semver')

function getNpmInfo(npmName, registry) {
  if (!npmName) {
    return null
  }

  const registryUrl = registry || getDefaultRegistry()
  const npmInfoUrl = urlJoin(registryUrl, npmName)
  return axios
    .get(npmInfoUrl)
    .then(response => {
      if (response.status === 200) {
        return response.data
      }
      return null
    })
    .catch(e => {
      return Promise.reject(e)
    })
}

const getDefaultRegistry = (isOriginal = false) => {
  return isOriginal
    ? 'https://registry.npmjs.org'
    : 'https://registry.npm.taobao.org'
}
// const getNpmVersions = async (npmName, registry) => {
//   const res = await getNpmInfo(npmName, registry)
//   if (res) {
//     return Object.keys(res.versions)
//   } else {
//     return []
//   }
// }
// const getNpmSemverVersions = (baseV, versions) => {
//   versions = versions.filter(v => {
//     return semver.satisfies(v, `^${baseV}`)
//   })
//   return versions
// }
// const getNpmSemverVersion = async (baseV, npmName, registry) => {
//   const versions = await getNpmVersions(npmName, registry)
//   const latestVersion = getNpmSemverVersions(baseV, versions)
//   console.log('latestVersion', latestVersion)
// }
module.exports = { getNpmInfo, getDefaultRegistry }
