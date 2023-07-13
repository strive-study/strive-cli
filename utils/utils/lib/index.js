const cp = require('child_process')
const fs = require('fs')

const Spinner = require('cli-spinner').Spinner

function isObject(o) {
  return Object.prototype.toString.call(o) === '[object Object]'
}

function spinnerStart(msg) {
  const spinner = new Spinner(`${msg}.. %s`)
  spinner.setSpinnerString('|/-\\')
  spinner.start()
  return spinner
}

function sleep(ts = 1000) {
  return new Promise(resolve => setTimeout(resolve, ts))
}

function spawn(command, args, options) {
  const win32 = process.platform === 'win32'
  const cmd = win32 ? 'cmd' : command
  const cmdArgs = win32 ? ['/c'].concat(command, args) : args
  return cp.spawn(cmd, cmdArgs, options || {})
}

function spawnAsync(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options)
    child.on('exit', e => {
      resolve(e)
    })

    child.on('error', e => {
      reject(e)
    })
  })
}

function readFile(path, options = {}) {
  if (fs.existsSync(path)) {
    const buffer = fs.readFileSync(path)
    if (buffer) {
      if (options.toJson) {
        return buffer.toJSON()
      }
      return buffer.toString()
    }
  }
  return null
}

function writeFile(path, data, { rewrite = true } = {}) {
  if (fs.existsSync(path)) {
    if (rewrite) {
      fs.writeFileSync(path, data)
      return true
    }
    return false
  } else {
    fs.writeFileSync(path, data)
    return true
  }
}

module.exports = {
  isObject,
  spinnerStart,
  sleep,
  spawn,
  spawnAsync,
  readFile,
  writeFile
}
