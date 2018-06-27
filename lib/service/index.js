const jm = require('jm-dao')
const event = require('jm-event')
const MS = require('jm-ms')
const error = require('jm-err')
const wechatUser = require('./wechatUser')

let ms = MS()

class Passport {
  constructor (opts = {}) {
    event.enableEvent(this)
    this.ready = true
    let self = this
    let bind = (name, uri) => {
      uri || (uri = '/' + name)
      ms.client({
        uri: opts.gateway + uri
      }, function (err, doc) {
        !err && doc && (self[name] = doc)
      })
    }
    bind('sso')
    bind('user')
    bind('wechat')

    let cb = (db) => {
      this.db = db
      this.wechatUser = wechatUser(this)
      this.ready = true
      this.emit('ready')
    }

    if (!opts.db) {
      jm.db.connect().then(cb)
    } else if (typeof opts.db === 'string') {
      jm.db.connect(opts.db).then(cb)
    }
  }

  onReady () {
    let self = this
    return new Promise(function (resolve, reject) {
      if (self.ready) return resolve(self.ready)
      self.once('ready', function () {
        resolve(self.ready)
      })
    })
  }

  /**
   * 根据微信获取的用户查找对应用户并返回token，如果查不到，先注册用户
   * @param opts
   * @param ips
   * @returns {Promise<*>}
   */
  async signon (opts = {}, ips) {
    let userInfo = opts
    let wechat = {
      unionid: userInfo.unionid,
      mp: {
        openid: userInfo.openid,
        headimgurl: userInfo.headimgurl
      }
    }

    // 检查是否已经存在
    let doc = null
    if (userInfo.unionid) {
      doc = await this.wechatUser.findOne({'unionid': userInfo.unionid})
    } else {
      doc = await this.wechatUser.findOne({'mp.openid': userInfo.openid})
    }
    let data = {
      nick: userInfo.nickname,
      gender: userInfo.sex,
      country: userInfo.country,
      province: userInfo.province,
      city: userInfo.city,
      ext: {
        wechat
      }
    }
    if (doc) {
      let ext = data.ext
      delete data.ext
      await this.user.post(`/users/${doc.id}`, data)
      await this.user.post(`/users/${doc.id}/ext`, ext)
    } else {
      doc = await this.user.request({uri: '/users', type: 'post', data, ips})
      if (doc.err) throw error.err(doc)

      data = Object.assign({}, wechat, {_id: doc.id})
      doc = await this.wechatUser.create(data)
    }
    data = {
      id: doc.id
    }
    doc = await this.sso.request({uri: '/signon', type: 'post', data, ips})
    if (doc.err) throw error.err(doc)
    return doc
  }

  /**
   * 登陆
   * @param {Object} opts
   * @example
   * opts参数:{
   *  code: 授权code
   * }
   * @returns {Promise<*>}
   */
  async login (opts = {}, ips = []) {
    // 从微信获取用户信息
    let doc = await this.wechat.get(`/oauth/${opts.code}/user`)
    if (doc.err) throw error.err(doc)
    if (doc.errcode) {
      throw error.err({
        err: doc.errcode,
        msg: doc.errmsg
      })
    }
    doc = await this.signon(doc, ips)
    this.emit('login', {id: doc.id})
    return doc
  }

  /**
   * 登陆, 根据openid直接登陆, 有风险, 所以仅限于信任的服务器之间直接调用
   * @param {Object} opts
   * @example
   * opts参数:{
   *  code: 授权code
   * }
   * @returns {Promise<*>}
   */
  async loginByOpenid (opts = {}, ips = []) {
    // 从微信获取用户信息
    let doc = await this.wechat.get(`/users/${opts.openid}`)
    if (doc.err) throw error.err(doc)
    doc = await this.signon(doc, ips)
    this.emit('login', {id: doc.id})
    return doc
  }
}

module.exports = Passport
