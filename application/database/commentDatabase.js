/*
Controller for handling mongodb and the data model comment while providing CRUD'ish.
*/

'use strict';

const helper = require('./helper'),
  commentModel = require('../models/comment.js'),
  oid = require('mongodb').ObjectID,
  collectionName = 'discussions';

module.exports = {
  get: function(identifier) {
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((col) => col.findOne({
        _id: oid(identifier)
      }));
  },

  insert: function(comment) {
    //TODO check for content and parent comment ids to be existant
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((col) => {
        let valid = false;
        comment.timestamp = new Date();
        try {
          valid = commentModel(comment);
          if (!valid) {
            return commentModel.errors;
          }

          return col.insertOne(comment);
        } catch (e) {
          console.log('validation failed', e);
        }
        return;
      }); //id is created and concatenated automatically
  },

  replace: function(id, comment) {
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((col) => {
        let valid = false;
        comment.timestamp = new Date();
        try {
          valid = commentModel(comment);

          if (!valid) {
            return commentModel.errors;
          }

          return col.update({_id: oid(id)}, comment, { upsert: true });
        } catch (e) {
          console.log('validation failed', e);
        }
        return;
      });
  },

  delete: function(identifier) {
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((col) => col.remove({
        _id: oid(identifier)
      }));
  }

};
