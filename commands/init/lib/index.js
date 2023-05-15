'use strict'

module.exports = (projectName, options, cmdObj) => {
  // const targetPath = cmdObj.parent.opts().targetPath
  const targetPath = process.env.CLI_TARGET_PATH
  console.log('init-->', projectName, options, targetPath)
}
