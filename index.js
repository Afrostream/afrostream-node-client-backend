'use strict';

var assert = require('better-assert');

var _ = require('lodash');
var Q = require('q');
var request = require('request');

var config = require('./config');

var Client = function (options) {
  assert(options, 'missing options (apiKey & apiSecret)');
  assert(typeof options.apiKey === 'string' && options.apiKey, 'missing apiKey');
  assert(typeof options.apiSecret === 'string' && options.apiSecret, 'missing apiSecret');

  this.silent = (options.silent === false) ? false : true;
  this.requestId = 0;
  this.defaultQueryOptions = { json: true, timeout: options.timeout || 2000 };
  this.config = _.merge({}, config, options.config);
  this.apiKey = options.apiKey;
  this.apiSecret = options.apiSecret;
  // advanced configuration
  this.successHttpCodeList = options.successHttpCodeList || [ 200 ];
  // internal state
  this.token = null;
};

/**
 * low level request to backend
 *   pre-configured options : { json: true }
 * + relative to absolute path convertion for "uri" string
 *
 * @param queryOptions  @see request library options.
 * @return Promise<[response, body]|Error>
 * @example:
 *   client.request({uri:'/api/movies'}).then(...)
 */
Client.prototype.request = function (inputQueryOptions) {
  assert(inputQueryOptions);
  assert(typeof inputQueryOptions.uri === 'string');

  var requestId = ++this.requestId;
  var silent = this.silent;
  //
  var defaultQueryOptions = this.defaultQueryOptions; // json, timeout, ...
  var computedQueryOptions = {};                      // headers forwarded to backend (x-forwarded-(user-ip,agent)|Content-type)
  // inputQueryOptions                                // input code options
  var rewritedQueryOptions = {};                      // uri
  var queryOptions = {};                              // result

  // forwarding input request info to the backend
  if (inputQueryOptions.req) {
    computedQueryOptions = {
      headers: {
        'x-forwarded-user-ip': inputQueryOptions.req.userIp,
        'x-forwarded-user-agent': inputQueryOptions.req.get('User-Agent'),
        'Content-Type': inputQueryOptions.req.get('Content-Type')
      }
    }
  }

  if (inputQueryOptions.token) {
    _.merge(computedQueryOptions, { headers: { Authorization: 'Bearer ' + inputQueryOptions.token } });
  }

  // processing uri
  if (inputQueryOptions.uri.substr(0, 4) !== 'http') {
    rewritedQueryOptions.uri = this.config['afrostream-back-end'].baseUrl + inputQueryOptions.uri;
  }

  // result
  queryOptions = _.merge({}, defaultQueryOptions, computedQueryOptions, inputQueryOptions, rewritedQueryOptions);
  if (!silent) {
    console.log('[INFO]: [CLIENT-BACKEND]: [' + requestId + ']: call ' + JSON.stringify(queryOptions));
  }

  return Q.nfcall(request, queryOptions)
    .then(
    function (data) {
      if (!data[0]) {
        console.log('[WARNING]: [CLIENT-BACKEND]: [' + requestId + ']: no response for ' + JSON.stringify(queryOptions));
        throw new Error('no response');
      } else {
        if (!silent) {
          console.log('[INFO]: [CLIENT-BACKEND]: [' + requestId + ']: ' + data[0].statusCode + ' ' + JSON.stringify(data[1]));
        }
      }
      data[0].requestId = requestId;
      return data;
    },
    function (err) {
      console.error('[ERROR]: [CLIENT-BACKEND]: [' + requestId + ']: ' + err.message + ' for ' + JSON.stringify(queryOptions));
      var error = new Error(err.message);
      error.statusCode = 500;
      throw error;
    });
};

Client.prototype.custom = function (queryOptions) {
  var that = this;

  return this.request(queryOptions)
    .then(function (data) {
      var response = data[0]
        , body = data[1];

      if (that.successHttpCodeList.indexOf(response.statusCode) === -1) {
        console.log('[WARNING]: [CLIENT-BACKEND]: [' + response.requestId + ']: ' + data[0].statusCode + ' ' + JSON.stringify(body));
        var error = new Error(body && body.error || 'unknown');
        error.statusCode = response.statusCode || 500;
        throw error;
      }
      return body;
    });
};

Client.prototype.isTokenValid = function (token) {
  return token && new Date(token.expires_at).getTime() > Date.now();
};

Client.prototype.getToken = function () {
  var that = this;

  if (this.isTokenValid(this.token)) {
    return Q(this.token);
  }
  return this.custom({
    method: 'POST',
    uri: '/auth/oauth2/token',
    body: {
      grant_type: 'client_credentials',
      client_id: this.apiKey,
      client_secret: this.apiSecret
    }
  }).then(function (body) {
    that.token = body;
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
      return that.custom(_.merge({ token: clientToken.access_token }, queryOptions));
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
      return that.custom(_.merge({ method: 'POST', token: clientToken.access_token }, queryOptions));
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
      return that.custom(_.merge({ method: 'PUT', token: clientToken.access_token }, queryOptions));
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
      return that.custom(_.merge({ method: 'DELETE', token: clientToken.access_token }, queryOptions));
    });
};

Client.prototype.proxy = function (req, res) {
  assert(['GET', 'POST', 'PUT', 'DELETE'].indexOf(req.method) !== -1);

  var queryOptions = { method: req.method, req: req, qs: req.query, body: req.body };
  return this.request(queryOptions)
    .then(this.fwd(res));
};

Client.prototype.fwd = function (res) {
  return function (err, data) {
    if (err) {
      res.status(500).json({error: String(err)});
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