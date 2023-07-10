const axios = require('axios')

module.exports = {
  createComponent: async function (payload) {
    try {
      const res = await axios.post(
        'http://localhost:3000/api/v1/components',
        payload
      )
      const { data } = res
      if (data.code === 0) {
        return data.data
      }
      return null
    } catch (e) {
      throw e
    }
  }
}
