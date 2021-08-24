'use strict';

module.exports = {
  require: ['@babel/register', '@babel/polyfill', './test/common.js'],
  exit: true,
  recursive: true,
  reporter: 'spec',
};
