'use strict';

const helper = require('./helper');

// this function should include commands that create indexes (if any)
// for any collections that the service may be using

// it should always return a promise
module.exports = function() {

  return helper.getCollection('discussions').then((discussions) => {
    return discussions.createIndexes([
      { key: {'content_kind': 1, 'content_id': 1} }
    ]);
  });

};
