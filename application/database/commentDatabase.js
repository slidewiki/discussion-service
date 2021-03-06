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

  getAll: function(content_kind, identifier) {
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((col) => col.find({content_kind: content_kind, content_id: identifier }))
      .then((stream) => stream.sort({timestamp: -1}))
      .then((stream) => stream.toArray());
  },

  getCount: function(content_kind, identifier) {
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((col) => col.count({content_kind: content_kind, content_id: identifier }));
  },

  getCountAllWithProperties: function(slideIdArray, deckIdArray) {
    const slideIdQuery = {$and: [{content_kind: 'slide'}, { content_id: { $in: slideIdArray } }]};
    const deckIdQuery = {$and: [{content_kind: 'deck'}, { content_id: { $in: deckIdArray } }]};
    const query = {$or: [slideIdQuery, deckIdQuery]};

    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((col) => col.count(query));
  },

  getAllWithProperties: function(slideIdArray, deckIdArray) {
    const slideIdQuery = {$and: [{content_kind: 'slide'}, { content_id: { $in: slideIdArray } }]};
    const deckIdQuery = {$and: [{content_kind: 'deck'}, { content_id: { $in: deckIdArray } }]};
    const query = {$or: [slideIdQuery, deckIdQuery]};

    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((col) => col.find(query))
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

  partlyUpdate: (findQuery, updateQuery, params = undefined) => {
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((col) => col.update(findQuery, updateQuery, params));
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
