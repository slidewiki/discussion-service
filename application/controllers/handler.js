/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  commentDB = require('../database/commentDatabase'), //Database functions specific for slides
  co = require('../common');

module.exports = {
  //Get Comment from database or return NOT FOUND
  getComment: function(request, reply) {
    commentDB.get(encodeURIComponent(request.params.id)).then((comment) => {
      if (co.isEmpty(comment))
        reply(boom.notFound());
      else
        reply(co.rewriteID(comment));
    }).catch((error) => {

      request.log('error', error);
      reply(boom.badImplementation());
    });
  },

  //Create Comment with new id and payload or return INTERNAL_SERVER_ERROR
  newComment: function(request, reply) {
    commentDB.insert(request.payload).then((inserted) => {
      //console.log('inserted: ', inserted);
      if (co.isEmpty(inserted.ops[0]) || co.isEmpty(inserted.ops[0]))
        throw inserted;
      else
        reply(co.rewriteID(inserted.ops[0]));
    }).catch((error) => {
      request.log('error', error);
      reply(boom.badImplementation());
    });
  },


  //Update Comment with id id and payload or return INTERNAL_SERVER_ERROR
  updateComment: function(request, reply) {
    commentDB.replace(encodeURIComponent(request.params.id), request.payload).then((replaced) => {
      //console.log('updated: ', replaced);
      if (co.isEmpty(replaced.value))
        throw replaced;
      else
        reply(replaced.value);
    }).catch((error) => {
      request.log('error', error);
      reply(boom.badImplementation());
    });
  },

  getDiscussion: function(request, reply) {
    reply(boom.notImplemented);
  }
};
