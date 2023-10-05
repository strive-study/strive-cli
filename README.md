# 工程化脚手架

## **Usage**

### Install

推荐使用 Node 版本：v16.x

```javascript
npm install -g @strive-cli/cli
```

安装后检查安装是否成功

```javascript
strive - V
```

## **Command**

### init

init 命令用于初始化一个自定义项目模板，模板分工程模板和组件库模板。任何一种模板又分普通模板和自定义模板，自定义模板安装后不会自动安装依赖，启动服务。<br/>
模板数据暂时只提供几个基础模板。

```javascript
strive init [projectName]
```

#### Option

- `-f, --force`, 是否强制初始化项目, 默认 false

### publish

publish 命令用于发布一个已存在的项目到 Git 仓库中，Git 仓库支持 Gitee 和 Github。<br/>
在发布时会自动创建远程仓库，prod 模式下会自动创建对应版本 tag。

```javascript
strive publish
```

#### Option

- `--refreshServer`, 强制更新远程 Git 仓库
- `--refreshToken`, 强制更新远程仓库 Token
- `--refreshOwner`, 强制更新远程仓库所属类型
- `--buildCmd [buildCmd]`, 自定义构建命令
- `--prod`, 是否正式发布
- `--sshUser [sshUser]`, 模板服务器用户名
- `--sshIp [sshIp]`, 模板服务器 Ip 或域名
- `--sshPath [sshPath]`, 模板服务器上传路径

### add

`add`命令用于在已有项目中创建代码片段，代码片段需提前创建，由于一些服务到期，暂时不要使用。

```javascript
strive add [templateName]
```

#### Option

- `-f, --force`, 是否强制添加代码, 默认 false
