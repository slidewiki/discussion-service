/*
These are routes as defined in https://docs.google.com/document/d/1337m6i7Y0GPULKLsKpyHR4NRzRwhoxJnAZNnDFCigkc/edit#
Each route implementes a basic parameter/payload validation and a swagger API documentation description
*/
'use strict';

const Joi = require('joi'),
  handlers = require('./controllers/handler');

module.exports = function(server) {
  //Get discussion with content id id from database and return the entire tree (when not available, return NOT FOUND). Validate id
  server.route({
    method: 'GET',
    path: '/discussion/{id}',
    handler: handlers.getDiscussion,
    config: {
      validate: {
        params: {
          id: Joi.string().alphanum().lowercase()
        },
      },
      tags: ['api'],
      description: 'Get a discussion'
    }
  });

  //Get comment with id id from database and return it (when not available, return NOT FOUND). Validate id
  server.route({
    method: 'GET',
    path: '/comment/{id}',
    handler: handlers.getComment,
    config: {
      validate: {
        params: {
          id: Joi.string().alphanum().lowercase()
        },
      },
      tags: ['api'],
      description: 'Get a comment'
    }
  });

  //Create new comment (by payload) and return it (...). Validate payload
  server.route({
    method: 'POST',
    path: '/comment/new',
    handler: handlers.newComment,
    config: {
      validate: {
        payload: Joi.object().keys({
          title: Joi.string(),
          text: Joi.string(),
          user_id: Joi.string().alphanum().lowercase(),
          content_id: Joi.string().alphanum().lowercase(),
          content_kind: Joi.string().valid('deck', 'slide'),
          parent_comment: Joi.string().alphanum().lowercase()
        }).requiredKeys('content_id', 'user_id'),
      },
      tags: ['api'],
      description: 'Create a new comment'
    }
  });

  //Update comment with id id (by payload) and return it (...). Validate payload
  server.route({
    method: 'PUT',
    path: '/comment/{id}',
    handler: handlers.updateComment,
    config: {
      validate: {
        params: {
          id: Joi.string().alphanum().lowercase()
        },
        payload: Joi.object().keys({
          title: Joi.string(),
          text: Joi.string(),
          user_id: Joi.string().alphanum().lowercase(),
          content_id: Joi.string().alphanum().lowercase(),
          content_kind: Joi.string().valid('deck', 'slide'),
          parent_comment: Joi.string().alphanum().lowercase()
        }).requiredKeys('content_id', 'user_id'),
      },
      tags: ['api'],
      description: 'Replace a comment'
    }
  });

  server.route({
    method: 'DELETE',
    path: '/comment/delete',
    handler: handlers.deleteComment,
    config: {
      validate: {
        payload: {
          id: Joi.string().alphanum().lowercase()
        },
      },
      tags: ['api'],
      description: 'Delete a comment'
    }
  });
  
  server.route({
    method: 'DELETE',
    path: '/discussion/delete',
    handler: handlers.deleteDiscussion,
    config: {
      validate: {
        payload: {
          content_id: Joi.string().alphanum().lowercase()
        },
      },
      tags: ['api'],
      description: 'Delete a discussion'
    }
  });
};
