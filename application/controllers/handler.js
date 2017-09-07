/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/
/* eslint promise/always-return: "off" */

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  commentDB = require('../database/commentDatabase'), //Database functions specific for comments
  co = require('../common');

const Microservices = require('../configs/microservices');
// let http = require('http');
let rp = require('request-promise-native');
//Send request to insert new activity

let self = module.exports = {
  //Get Comment from database or return NOT FOUND
  getComment: function(request, reply) {
    return commentDB.get(encodeURIComponent(request.params.id)).then((comment) => {
      if (co.isEmpty(comment))
        reply(boom.notFound());
      else {
        return insertAuthor(comment).then((comment) => {
          reply(co.rewriteID(comment));
        }).catch((error) => {
          tryRequestLog(request, 'error', error);
          reply(boom.badImplementation());
        });
      }
    }).catch((error) => {
      tryRequestLog(request, 'error', error);
      reply(boom.badImplementation());
    });
  },

  //Create Comment with new id and payload or return INTERNAL_SERVER_ERROR
  newComment: function(request, reply) {
    return addContentRevisionIfMissing(request.payload)
      .then((comment) => {
        commentDB.insert(comment).then((inserted) => {
          if (co.isEmpty(inserted.ops) || co.isEmpty(inserted.ops[0]))
            throw inserted;
          else {
            return insertAuthor(inserted.ops[0]).then((comment) => {
              reply(co.rewriteID(comment));
            }).catch((error) => {
              tryRequestLog(request, 'error', error);
              reply(boom.badImplementation());
            });
          }
        }).catch((error) => {
          tryRequestLog(request, 'error', error);
          reply(boom.badImplementation());
        });
      }).catch((error) => {
        tryRequestLog(request, 'error', error);
        reply(boom.badImplementation());
      });
  },

  //Update Comment with id id and payload or return INTERNAL_SERVER_ERROR
  updateComment: function(request, reply) {
    return commentDB.replace(encodeURIComponent(request.params.id), request.payload).then((replaced) => {
      if (co.isEmpty(replaced.value))
        throw replaced;
      else
        reply(replaced.value);
    }).catch((error) => {
      tryRequestLog(request, 'error', error);
      reply(boom.badImplementation());
    });
  },

  //Delete Comment with id id
  deleteComment: function(request, reply) {
    return commentDB.delete(encodeURIComponent(request.payload.id)).then(() =>
      reply({'msg': 'comment is successfully deleted...'})
    ).catch((error) => {
      tryRequestLog(request, 'error', error);
      reply(boom.badImplementation());
    });
  },

  //Delete Discussions with content id id
  deleteDiscussion: function(request, reply) {
    return commentDB.deleteAllWithContentID(encodeURIComponent(request.payload.content_id)).then(() =>
      reply({'msg': 'discussion is successfully deleted...'})
    ).catch((error) => {
      tryRequestLog(request, 'error', error);
      reply(boom.badImplementation());
    });
  },

  //Get All Comments from database for the id in the request
  //In case of a deck -  include its subdecks and slides
  getDiscussion: function(request, reply) {
    if (request.params.id === '-1') {
      self.getAllDiscussions(request, reply);
    } else {
      let content_kind = request.params.content_kind;

      return addContentRevisionIdIfMissing(content_kind, request.params.id)
        .then((contentId) => {

          return getSubdecksAndSlides(content_kind, contentId).then((arrayOfDecksAndSlides) => {
            let slideIdArray = [];
            let deckIdArray = [];

            arrayOfDecksAndSlides.forEach((deckOrSlide) => {
              if (deckOrSlide.type === 'slide') {
                slideIdArray.push(deckOrSlide.id);
              } else {
                deckIdArray.push(deckOrSlide.id);
              }
            });

            const metaonly = request.query.metaonly;
            if (metaonly === 'true') {
              return commentDB.getCountAllWithProperties(slideIdArray, deckIdArray)
                .then((count) => {
                  reply ({count: count});
                }).catch((error) => {
                  tryRequestLog(request, 'error', error);
                  reply(boom.badImplementation());
                });
            } else {
              return commentDB.getAllWithProperties(slideIdArray, deckIdArray)
                .then((comments) => {
                  comments.forEach((comment) => {
                    co.rewriteID(comment);

                    //set content_name
                    const slide = arrayOfDecksAndSlides.find((slide) =>  (slide.type === comment.content_kind && slide.id === comment.content_id));
                    if (slide) {
                      comment.content_name = slide.title;
                    }
                  });

                  let replies = [];
                  let arrayOfAuthorPromises = [];
                  comments.forEach((comment, index) => {
                    let promise = insertAuthor(comment);
                    arrayOfAuthorPromises.push(promise);

                    //move replies to their places
                    let parent_comment_id = comment.parent_comment;
                    if (parent_comment_id !== undefined) {
                      let parentComment = findComment(comments, parent_comment_id);
                      if (parentComment !== null) {//found parent comment
                        if (parentComment.replies === undefined) {//first reply
                          parentComment.replies = [];
                        }
                        parentComment.replies.push(comment);
                        replies.push(index);//remember index, to remove it later
                      }
                    }
                  });
                  Promise.all(arrayOfAuthorPromises).then(() => {
                    //remove comments which were inserted as replies
                    replies.reverse();
                    replies.forEach((i) => {
                      comments.splice(i, 1);
                    });

                    let jsonReply = JSON.stringify({items: comments, count: comments.length});
                    reply(jsonReply);

                  }).catch((error) => {
                    tryRequestLog(request, 'error arrayOfAuthorPromises', error);
                    reply(boom.badImplementation());
                  });
                }).catch((error) => {
                  tryRequestLog(request, 'error getAllWithProperties', error);
                  reply(boom.badImplementation());
                });
            }
          }).catch((error) => {
            tryRequestLog(request, 'error getSubdecksAndSlides', error);
            reply(boom.badImplementation());
          });
        }).catch((error) => {
          tryRequestLog(request, 'error addContentRevisionIdIfMissing', error);
          reply(boom.badImplementation());
        });
    }
  },

  //Get All Comments from database
  getAllDiscussions: function(request, reply) {
    return commentDB.getAllFromCollection()
      .then((comments) => {
        comments.forEach((comment) => {
          co.rewriteID(comment);
        });

        let replies = [];
        let arrayOfAuthorPromises = [];
        comments.forEach((comment, index) => {
          let promise = insertAuthor(comment);
          arrayOfAuthorPromises.push(promise);

          //move replies to their places
          let parent_comment_id = comment.parent_comment;
          if (parent_comment_id !== undefined) {
            let parentComment = findComment(comments, parent_comment_id);
            if (parentComment !== null) {//found parent comment
              if (parentComment.replies === undefined) {//first reply
                parentComment.replies = [];
              }
              parentComment.replies.push(comment);
              replies.push(index);//remember index, to remove it later
            }
          }
        });
        Promise.all(arrayOfAuthorPromises).then(() => {
          //remove comments which were inserted as replies
          replies.reverse();
          replies.forEach((i) => {
            comments.splice(i, 1);
          });

          let jsonReply = JSON.stringify(comments);
          reply(jsonReply);

        }).catch((error) => {
          tryRequestLog(request, 'error', error);
          reply(boom.badImplementation());
        });
      }).catch((error) => {
        tryRequestLog(request, 'error', error);
        reply(boom.badImplementation());
      });
  },

  //Get the number of comments from database for the id in the request (also for subdecks and slides)
  getDiscussionCount: function(request, reply) {
    const content_kind = request.params.content_kind;
    return addContentRevisionIdIfMissing(content_kind, request.params.id)
      .then((contentId) => {

        return getSubdecksAndSlides(content_kind, contentId).then((arrayOfDecksAndSlides) => {
          let slideIdArray = [];
          let deckIdArray = [];

          arrayOfDecksAndSlides.forEach((deckOrSlide) => {
            if (deckOrSlide.type === 'slide') {
              slideIdArray.push(deckOrSlide.id);
            } else {
              deckIdArray.push(deckOrSlide.id);
            }
          });

          return commentDB.getCountAllWithProperties(slideIdArray, deckIdArray)
            .then((count) => {
              reply (count);
            }).catch((error) => {
              tryRequestLog(request, 'error', error);
              reply(boom.badImplementation());
            });
        }).catch((error) => {
          tryRequestLog(request, 'error', error);
          reply(boom.badImplementation());
        });
      }).catch((error) => {
        tryRequestLog(request, 'error', error);
        reply(boom.badImplementation());
      });
  }
};

//Find comment in a tree with id = identifier
function findComment(array, identifier) {
  for(let i = 0; i < array.length; i++) {
    let comment = array[i];
    if (String(comment.id) === String(identifier)) {
      return comment;
    } else if (comment.replies !== undefined) {
      let commentFound = findComment(comment.replies, identifier);
      if (commentFound !== null)
        return commentFound;
    }
  }
  return null;
}

//insert author data using user microservice
function insertAuthor(comment) {
  let myPromise = new Promise((resolve, reject) => {

    let username = 'unknown';
    let avatar = '';
    rp.get({uri: Microservices.user.uri + '/user/' + comment.user_id}).then((res) => {
      try {
        let parsed = JSON.parse(res);
        username = parsed.username;
        avatar = parsed.picture;
      } catch(e) {
        console.log(e);
      }

      comment.author = {
        id: comment.user_id,
        username: username,
        avatar: avatar
      };
      resolve(comment);
    }).catch((err) => {
      console.log('Error', err);
      comment.author = {
        id: comment.user_id,
        username: username,
        avatar: avatar
      };
      resolve(comment);
    });
  });

  return myPromise;
}

//find content revision using deck microservice
function addContentRevisionIfMissing(comment) {
  let myPromise = new Promise((resolve, reject) => {
    let contentIdParts = comment.content_id.split('-');
    if (contentIdParts.length === 1) {
      rp.get({uri: Microservices.deck.uri + '/' + comment.content_kind + '/' + comment.content_id}).then((res) => {
        try {
          let parsed = JSON.parse(res);
          comment.content_id += '-' + parsed.active;
        } catch(e) {
          console.log(e);
        }
        resolve(comment);
      }).catch((err) => {
        console.log('Error', err);
        resolve(comment);
      });
    } else {
      resolve(comment);
    }
  });

  return myPromise;
}

function addContentRevisionIdIfMissing(contentKind, contentId) {
  let myPromise = new Promise((resolve, reject) => {
    let contentIdParts = contentId.split('-');
    if (contentIdParts.length > 1) {//there is a revision id
      resolve(contentId);
    } else {
      rp.get({uri: Microservices.deck.uri + '/' + contentKind + '/' + contentId}).then((res) => {
        try {
          let parsed = JSON.parse(res);
          let revisionId = 1;
          if (parsed.revisions !== undefined && parsed.revisions.length > 0 && parsed.revisions[0] !== null) {
            revisionId = (parsed.active) ? parsed.active : (parsed.revisions.length - 1);
          }
          resolve(contentId + '-' + revisionId);
        } catch(e) {
          console.log(e);
          resolve(contentId);
        }
      }).catch((err) => {
        console.log('Error', err);
        resolve(contentId);
      });
    }
  });

  return myPromise;
}

function getSubdecksAndSlides(content_kind, id) {
  let myPromise = new Promise((resolve, reject) => {
    if (content_kind === 'slide') {
      resolve([{
        type: content_kind,
        id: id
      }]);
    } else {//if deck => get activities of all its decks and slides
      let arrayOfSubdecksAndSlides = [];
      rp.get({uri: Microservices.deck.uri +  '/decktree/' + id}).then((res) => {

        try {
          let parsed = JSON.parse(res);
          arrayOfSubdecksAndSlides = getArrayOfChildren(parsed);
        } catch(e) {
          console.log(e);
          resolve(arrayOfSubdecksAndSlides);
        }

        resolve(arrayOfSubdecksAndSlides);
      }).catch((err) => {
        console.log('Error', err);

        resolve(arrayOfSubdecksAndSlides);
      });
    }
  });

  return myPromise;
}

function getArrayOfChildren(node) {//recursive
  let array = [{
    type: node.type,
    id: node.id,
    title: node.title
  }];
  if (node.children) {
    node.children.forEach((child) => {
      array = array.concat(getArrayOfChildren(child));
    });
  }
  return array;
}

//This function tries to use request log and uses console.log if this doesnt work - this is the case in unit tests
function tryRequestLog(request, message, _object) {
  try {
    request.log(message, _object);
  } catch (e) {
    console.log(message, _object);
  }
}
