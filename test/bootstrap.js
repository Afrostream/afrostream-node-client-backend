'use strict';

process.env.NODE_ENV = 'test';

var config = require('../config');

if (config.env !== 'test') {
  console.error('test should only be run on test env');
  process.exit(0);
}

process.on('uncaughtException', function(err) {
  console.error('Caught exception: ' + err);
});

