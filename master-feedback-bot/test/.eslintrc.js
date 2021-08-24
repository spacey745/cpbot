'use strict';

module.exports = {
  extends: ['../../../.eslintrc.js'],
  env: {
    mocha: true,
  },
  plugins: ['mocha'],
  globals: {
    should: 'readonly',
  },
};
