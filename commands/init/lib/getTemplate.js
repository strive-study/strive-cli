const request = require('@strive-cli/request')

module.exports = function () {
  return request({
    url: '/project/template'
  })
}
