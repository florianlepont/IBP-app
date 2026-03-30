class JwksClient {
  constructor() {}
  getSigningKey(_kid, cb) {
    cb(new Error("jwks-rsa mock: not available in test mode"))
  }
}

module.exports = { JwksClient }
