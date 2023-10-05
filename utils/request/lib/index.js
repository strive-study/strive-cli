const axios = require('axios')

const BASE_URL = process.env.STRIVE_CLI_BASE_URL || 'http://43.138.12.24:3000'

const request = axios.create({
  baseURL: BASE_URL,
  timeout: 10000
})

request.interceptors.response.use(
  res => {
    return res.data
  },
  err => {
    return Promise.reject(err)
  }
)

module.exports = request
