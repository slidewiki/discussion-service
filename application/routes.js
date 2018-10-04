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
    path: '/discussion/{content_kind}/{id}',
    handler: handlers.getDiscussion,
    config: {
      validate: {
        params: {
          content_kind: Joi.string().valid('deck', 'slide'),
          id: Joi.string().description('The id of the deck/slide')
        },
        query: {
          metaonly: Joi.string().description('Set to true to return only metadata without the list of comments'),
          all_revisions: Joi.string().description('Set to true to search for comments regardles of the content revision'),
        }
      },
      tags: ['api'],
      description: 'Get a discussion'
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
          text: Joi.string().allow(''),
          user_id: Joi.string(),
          content_id: Joi.string(),
          content_kind: Joi.string().valid('deck', 'slide'),
          parent_comment: Joi.string()
        }).requiredKeys('content_id', 'user_id'),
      },
      tags: ['api'],
      description: 'Create a new comment'
    }
  });

  //Delete comment with id id (by payload) . Validate payload
  server.route({
    method: 'DELETE',
    path: '/comment/delete',
    handler: handlers.deleteComment,
    config: {
      validate: {
        payload: {
          id: Joi.string()
        },
      },
      tags: ['api'],
      description: 'Delete a comment'
    }
  });

  //Hide comment with id id (by payload) . Validate payload
  server.route({
    method: 'PUT',
    path: '/comment/hide',
    handler: handlers.hideComment,
    config: {
      validate: {
        payload: {
          id: Joi.string()
        },
      },
      tags: ['api'],
      description: 'Hide a comment'
    }
  });

  //Delete discussion with content id id (by payload) . Validate payload
  server.route({
    method: 'DELETE',
    path: '/discussion/delete',
    handler: handlers.deleteDiscussion,
    config: {
      validate: {
        payload: {
          content_id: Joi.string()
        },
      },
      tags: ['api'],
      description: 'Delete a discussion'
    }
  });
};
