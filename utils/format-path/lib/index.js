const path = require('path')

module.exports = p => {
  if (p && typeof p === 'string') {
    const sep = path.sep
    if (sep === '\\') {
      return p.replace(/\\/g, '/')
    }
  }
  return p
}
