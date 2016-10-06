'use strict';

var bootstrap = require('../bootstrap.js');

var Client = require('../../index.js');

var assert = require('better-assert');

// orange client
var apiKey = '610fa4d5-05ec-4493-b9a6-e50a04f7fdcc';
var apiSecret = 'b0eee6d9-8771-4d93-8407-ee67af60408c';

describe('client', function () {
  describe('instantiate client without key should', function () {
    it('should generetate an error', function (done) {
      try {
        var client = new Client();
      } catch (e) {
        assert(e.message.match(/missing options/));
        done();
      }
    });
  });
});

describe('client.get', function () {
  describe('client.get("/api/movies")', function () {
    it ('should return a body with 200 ok', function (done) {
      this.timeout(15000);

      var client = new Client({
        apiKey: apiKey,
        apiSecret: apiSecret
      });
      client.get('/api/movies').then(function (body) {
        assert(Array.isArray(body) && body.length);
        done();
      })
    });
  })
});
