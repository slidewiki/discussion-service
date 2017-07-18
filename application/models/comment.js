'use strict';

//require
let Ajv = require('ajv');
let ajv = Ajv({
  verbose: true,
  allErrors: true
    //v5: true  //enable v5 proposal of JSON-schema standard
}); // options can be passed, e.g. {allErrors: true}

//build schema
const objectid = {
  type: 'string',
  maxLength: 24,
  minLength: 1
};
const comment = {
  type: 'object',
  properties: {
    title: {
      type: 'string'
    },
    text: {
      type: 'string'
    },
    timestamp: {
      type: 'object'
    },
    user_id: objectid,
    parent_comment: objectid,
    content_id: {
      type: 'string'
    },
    content_kind: {
      type: 'string',
      enum: ['deck', 'slide']
    }
  },
  required: ['content_id', 'user_id']
};


//export
module.exports = ajv.compile(comment);
