const cp = require('child_process')

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

function sleep(ts) {
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

module.exports = { isObject, spinnerStart, sleep, spawn, spawnAsync }
