let mongoose = require('mongoose')
let Schema = mongoose.Schema

let schemaDefine = {
  mp: {
    unionid: {type: String, unique: true, sparse: true, index: true}, // 微信公众号unionid
    headimgurl: {type: String}
  }
}

module.exports = function (schema, opts) {
  schema = schema || new Schema()
  schema.add(schemaDefine)
  return schema
}
