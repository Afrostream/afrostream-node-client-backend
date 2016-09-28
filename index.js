'use strict';

var assert = require('better-assert');

var util = require('util');

var _ = require('lodash');
var Q = require('q');
var afrostreamNodeRequest = require('afrostream-node-request');

var config = require('./config');

var Client = function (options) {
  assert(options, 'missing options (apiKey & apiSecret)');
  assert(typeof options.apiKey === 'string' && options.apiKey, 'missing apiKey');
  assert(typeof options.apiSecret === 'string' && options.apiSecret, 'missing apiSecret');

  this.config = _.merge({}, config, options.config);
  this.apiKey = options.apiKey;
  this.apiSecret = options.apiSecret;
  // internal state
  this.token = null;
  //
  this.request = afrostreamNodeRequest.create({baseUrl:this.config['afrostream-back-end'].baseUrl});
};

Client.prototype.isTokenValid = function (token) {
  return token && new Date(token.expires_at).getTime() > Date.now();
};

Client.prototype.getToken = function () {
  var that = this;

  if (this.isTokenValid(this.token)) {
    return Q(this.token);
  }
  return this.request({
    method: 'POST',
    uri: '/auth/oauth2/token',
    body: {
      grant_type: 'client_credentials',
      client_id: this.apiKey,
      client_secret: this.apiSecret
    }
  }).then(function (data) {
    that.token = data[1];
    that.token.expires_at = new Date(Date.now() + 1000 * that.token.expires_in).toISOString();
    return that.token;
  });
};

Client.prototype.get = function () {
  // parsing parameters
  var queryOptions = arguments[0];
  if (typeof queryOptions === 'string') {
    queryOptions = { uri: queryOptions };
  }
  //
  assert(typeof queryOptions === 'object' && typeof queryOptions.uri == 'string' && queryOptions.uri);

  var that = this;

  return this.getToken()
    .then(function (clientToken) {
      queryOptions = (typeof queryOptions === 'string') ? { uri: queryOptions } : queryOptions;
      return that.request(_.merge({ token: clientToken.access_token }, queryOptions));
    })
    .then(function (data) {
      return data[1]; // body
    });
};

Client.prototype.post = function () {
  // parsing parameters
  var queryOptions = arguments[0];
  if (typeof queryOptions === 'string') {
    queryOptions = { uri: queryOptions, body: arguments[1] || {} };
  }

  //
  assert(typeof queryOptions === 'object' && typeof queryOptions.uri == 'string' && queryOptions.uri && queryOptions.body);

  var that = this;

  return this.getToken()
    .then(function (clientToken) {
      return that.request(_.merge({ method: 'POST', token: clientToken.access_token }, queryOptions));
    })
    .then(function (data) {
      return data[1]; // body
    });
};

Client.prototype.put = function () {
  // parsing parameters
  var queryOptions = arguments[0];
  if (typeof queryOptions === 'string') {
    queryOptions = { uri: queryOptions, body: arguments[1] || {} };
  }

  //
  assert(typeof queryOptions === 'object' && typeof queryOptions.uri == 'string' && queryOptions.uri && queryOptions.body);

  var that = this;

  return this.getToken()
    .then(function (clientToken) {
      return that.request(_.merge({ method: 'PUT', token: clientToken.access_token }, queryOptions));
    })
    .then(function (data) {
      return data[1]; // body
    });
};

Client.prototype.delete = function () {
  // parsing parameters
  var queryOptions = arguments[0];
  if (typeof queryOptions === 'string') {
    queryOptions = { uri: queryOptions };
  }

  //
  assert(typeof queryOptions === 'object' && typeof queryOptions.uri == 'string' && queryOptions.uri);

  var that = this;

  return this.getToken()
    .then(function (clientToken) {
      queryOptions = (typeof queryOptions === 'string') ? { uri: queryOptions } : queryOptions;
      return that.request(_.merge({ method: 'DELETE', token: clientToken.access_token }, queryOptions));
    })
    .then(function (data) {
      return data[1]; // body
    });
};

Client.prototype.proxy = function (req, res, queryOptions) {
  assert(['GET', 'POST', 'PUT', 'DELETE'].indexOf(req.method) !== -1);

  var that = this;

  return this.getToken()
    .then(function (clientToken) {
      queryOptions = _.merge({
        method: req.method,
        context: { req: req },
        qs: req.query,
        body: req.body,
        uri: req.originalUrl,
        token: clientToken.access_token,
        followRedirect: false,
        filter: null
      }, queryOptions);
      return that.request(queryOptions);
    })
    .nodeify(this.fwd(res));
};

Client.prototype.fwd = function (res) {
  return function (err, data) {
    if (err) {
      res.status(err.statusCode || 500).json({error: err.message || 'unknown error'});
    } else {
      var backendResponse = data[0]
        , backendBody = data[1];

      switch (backendResponse.statusCode) {
        case 301:
        case 302:
          if (backendResponse.headers &&
            backendResponse.headers.location) {
            res.set('location', backendResponse.headers.location);
          }
          break;
        default:
          break;
      }
      res.status(backendResponse.statusCode || 500).json(backendBody);
    }
  };
};

module.exports = Client;
