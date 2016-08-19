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

  getAll: function(identifier) {
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((col) => col.find({ content_id: identifier }))
      .then((stream) => stream.sort({timestamp: -1}))
      .then((stream) => stream.toArray());
  },

  getAllFromCollection: function() {
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((col) => col.find())
      .then((stream) => stream.sort({timestamp: -1}))
      .then((stream) => stream.toArray());
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

          return col.findOneAndUpdate({_id: oid(id)}, comment, { upsert: true, returnNewDocument: true });
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
  },

  deleteAllWithContentID: function(identifier) {
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((col) => col.remove({
        content_id: identifier
      }));
  },

  deleteAll: function() {
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((col) => col.remove());
  },

  createCollection: function() {
    return helper.connectToDatabase()
      .then((db) => db.createCollection(collectionName));
  }

};
