const axios = require('axios')
const BASE_URL = 'https://api.github.com'
class GithubRequest {
  constructor(token) {
    this.token = token
    this.service = axios.create({
      baseURL: BASE_URL,
      timeout: 5000
    })
    this.service.interceptors.request.use(
      config => {
        config.headers['Authorization'] = `Bearer ${token}`
        return config
      },
      err => {
        return Promise.reject(err)
      }
    )
    this.service.interceptors.response.use(
      res => {
        return res.data
      },
      error => {
        if (error.response && error.response.data) {
          return error.response
        } else {
          return Promise.reject(error)
        }
      }
    )
  }

  get(url, params, headers) {
    return this.service({
      url,
      params,
      method: 'get',
      headers
    })
  }
}

module.exports = GithubRequest
