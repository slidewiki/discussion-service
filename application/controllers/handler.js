/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  commentDB = require('../database/commentDatabase'), //Database functions specific for comments
  co = require('../common');

const Microservices = require('../configs/microservices');
let http = require('http');
//Send request to insert new activity
function createActivity(comment) {
  let myPromise = new Promise((resolve, reject) => {
    const activityType = (comment.parent_comment === undefined) ? 'comment' : 'reply';
    const commentId = comment._id ? comment._id : comment.id;//co.rewriteID(comment) might be executing at the same time

    let data = JSON.stringify({
      activity_type: activityType,
      user_id: comment.user_id,
      content_id: comment.content_id,
      content_kind: comment.content_kind,
      content_name: comment.content_name,
      content_owner_id: comment.content_owner_id,
      comment_info: {
        comment_id: commentId,
        text: comment.title
      }
    });

    let options = {
      host: Microservices.activities.uri,
      port: 80,
      path: '/activity/new',
      method: 'POST',
      headers : {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Content-Length': data.length
      }
    };

    let req = http.request(options, (res) => {
      // console.log('STATUS: ' + res.statusCode);
      // console.log('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      let body = '';
      res.on('data', (chunk) => {
        // console.log('Response: ', chunk);
        body += chunk;
      });
      res.on('end', () => {
        let newActivity = JSON.parse(body);
        resolve(newActivity);
      });
    });
    req.on('error', (e) => {
      console.log('problem with request: ' + e.message);
      reject(e);
    });
    req.write(data);
    req.end();
  });

  return myPromise;
}

module.exports = {
  //Get Comment from database or return NOT FOUND
  getComment: function(request, reply) {
    return commentDB.get(encodeURIComponent(request.params.id)).then((comment) => {
      if (co.isEmpty(comment))
        reply(boom.notFound());
      else {
        return insertAuthor(comment).then((comment) => {
          reply(co.rewriteID(comment));
        }).catch((error) => {
          request.log('error', error);
          reply(boom.badImplementation());
        });
      }
    }).catch((error) => {
      request.log('error', error);
      reply(boom.badImplementation());
    });
  },

  //Create Comment with new id and payload or return INTERNAL_SERVER_ERROR
  newComment: function(request, reply) {
    return findContentTitleAndOwner(request.payload)
      .then((contentTitleAndOwner) => {
        let contentIdParts = request.payload.content_id.split('-');
        if (contentIdParts.length === 1) {//there is no revision id
          request.payload.content_id += '-' + contentTitleAndOwner.revisionId;
        }
        commentDB.insert(request.payload).then((inserted) => {
          if (co.isEmpty(inserted.ops) || co.isEmpty(inserted.ops[0]))
            throw inserted;
          else {
            inserted.ops[0].content_name = contentTitleAndOwner.title;
            inserted.ops[0].content_owner_id = contentTitleAndOwner.ownerId;
            if (inserted.ops[0].is_activity === undefined || inserted.ops[0].is_activity === true) {//insert activity if not test initiated
              createActivity(inserted.ops[0]);
            }
            return insertAuthor(inserted.ops[0]).then((comment) => {
              reply(co.rewriteID(comment));
            }).catch((error) => {
              request.log('error', error);
              reply(boom.badImplementation());
            });
          }
        }).catch((error) => {
          request.log('error', error);
          reply(boom.badImplementation());
        });
      }).catch((error) => {
        request.log('error', error);
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
      request.log('error', error);
      reply(boom.badImplementation());
    });
  },

  //Delete Comment with id id
  deleteComment: function(request, reply) {
    return commentDB.delete(encodeURIComponent(request.payload.id)).then(() =>
      reply({'msg': 'comment is successfully deleted...'})
    ).catch((error) => {
      request.log('error', error);
      reply(boom.badImplementation());
    });
  },

  //Delete Discussions with content id id
  deleteDiscussion: function(request, reply) {
    return commentDB.deleteAllWithContentID(encodeURIComponent(request.payload.content_id)).then(() =>
      reply({'msg': 'discussion is successfully deleted...'})
    ).catch((error) => {
      request.log('error', error);
      reply(boom.badImplementation());
    });
  },

  //Get All Comments from database for the id in the request
  getDiscussion: function(request, reply) {
    let content_kind = request.params.content_kind;
    if (content_kind === undefined) {// this is just to serve requests from old front-end version
      content_kind = 'slide';
    }

    return addContentRevisionIdIfMissing(content_kind, request.params.id)
      .then((contentId) => {
        commentDB.getAll(content_kind, encodeURIComponent(contentId))
        .then((comments) => {
          // if (co.isEmpty(comments))
          //   reply(boom.notFound());
          // else {
          comments.forEach((comment) => {
            co.rewriteID(comment);
          });

          let replies = [];
          let arrayOfAuthorPromisses = [];
          comments.forEach((comment, index) => {
            let promise = insertAuthor(comment);
            arrayOfAuthorPromisses.push(promise);

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
          Promise.all(arrayOfAuthorPromisses).then(() => {
            //remove comments which were inserted as replies
            replies.reverse();
            replies.forEach((i) => {
              comments.splice(i, 1);
            });

            let jsonReply = JSON.stringify(comments);
            reply(jsonReply);

          }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
          });
        }).catch((error) => {
          request.log('error', error);
          reply(boom.badImplementation());
        });
      }).catch((error) => {
        request.log('error', error);
        reply(boom.badImplementation());
      });
  },

  //Get All Comments from database
  getAllDiscussions: function(request, reply) {
    return commentDB.getAllFromCollection()
      .then((comments) => {
        comments.forEach((comment) => {
          co.rewriteID(comment);
        });

        let replies = [];
        let arrayOfAuthorPromisses = [];
        comments.forEach((comment, index) => {
          let promise = insertAuthor(comment);
          arrayOfAuthorPromisses.push(promise);

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
        Promise.all(arrayOfAuthorPromisses).then(() => {
          //remove comments which were inserted as replies
          replies.reverse();
          replies.forEach((i) => {
            comments.splice(i, 1);
          });

          let jsonReply = JSON.stringify(comments);
          reply(jsonReply);

        }).catch((error) => {
          request.log('error', error);
          reply(boom.badImplementation());
        });
      }).catch((error) => {
        request.log('error', error);
        reply(boom.badImplementation());
      });
  },

  //Get the number of comments from database for the id in the request
  getDiscussionCount: function(request, reply) {
    return addContentRevisionIdIfMissing(request.params.content_kind, request.params.id)
      .then((contentId) => {
        commentDB.getCount(request.params.content_kind, encodeURIComponent(contentId))
          .then((count) => {
            reply (count);
          }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
          });
      }).catch((error) => {
        request.log('error', error);
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

    let options = {
      host: Microservices.user.uri,
      port: 80,
      path: '/user/' + comment.user_id
    };

    let req = http.get(options, (res) => {
      // console.log('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      let body = '';
      res.on('data', (chunk) => {
        // console.log('Response: ', chunk);
        body += chunk;
      });
      res.on('end', () => {
        let username = 'unknown';
        let avatar = '';
        if (res.statusCode === 200) {//user is found
          let parsed = JSON.parse(body);
          username = parsed.username;
          avatar = parsed.picture;
        }
        comment.author = {
          id: comment.user_id,
          username: username,
          avatar: avatar
        };
        resolve(comment);
      });
    });
    req.on('error', (e) => {
      console.log('problem with request: ' + e.message);
      reject(e);
    });
  });

  return myPromise;
}

//find content title and ownerId using deck microservice
function findContentTitleAndOwner(comment) {
  let myPromise = new Promise((resolve, reject) => {

    let options = {
      host: Microservices.deck.uri,
      port: 80,
      path: '/' + comment.content_kind + '/' + comment.content_id
    };

    let req = http.get(options, (res) => {
      // console.log('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      let body = '';
      res.on('data', (chunk) => {
        // console.log('Response: ', chunk);
        body += chunk;
      });
      res.on('end', () => {
        let title = '';
        let ownerId = 0;

        let contentIdParts = comment.content_id.split('-');
        let contentRevisionId = (contentIdParts.length > 1) ? contentIdParts[contentIdParts.length - 1] : undefined;
        if (res.statusCode === 200) {//content is found
          let parsed = JSON.parse(body);
          if (parsed.user) {
            ownerId = parsed.user;
          }
          if (parsed.revisions !== undefined && parsed.revisions.length > 0 && parsed.revisions[0] !== null) {
            //get title from result

            let contentRevision = (contentRevisionId !== undefined) ? parsed.revisions.find((revision) =>  String(revision.id) ===  String(contentRevisionId)) : undefined;

            if (contentRevision !== undefined) {
              ownerId = contentRevision.user;
              title = contentRevision.title;
            } else {//if revision from content_id is not found take data from active revision
              const activeRevisionId = parsed.active;
              let activeRevision = parsed.revisions[parsed.revisions.length - 1];//if active is not defined take the last revision in array
              if (activeRevisionId !== undefined) {
                activeRevision = parsed.revisions.find((revision) =>  String(revision.id) ===  String(activeRevisionId));
              }
              if (activeRevision !== undefined) {
                title = activeRevision.title;
                if (contentRevisionId === undefined) {
                  contentRevisionId = activeRevision.id;
                }
              }
            }
          }
        }
        resolve({title: title, ownerId: String(ownerId), revisionId: contentRevisionId});
      });
    });
    req.on('error', (e) => {
      console.log('problem with request: ' + e.message);
      reject(e);
    });
  });

  return myPromise;
}

function addContentRevisionIdIfMissing(contentKind, contentId) {
  let myPromise = new Promise((resolve, reject) => {
    let contentIdParts = contentId.split('-');
    if (contentIdParts.length > 1) {//there is a revision id
      resolve(contentId);
    } else {
      let options = {
        host: Microservices.deck.uri,
        port: 80,
        path: '/' + contentKind + '/' + contentId
      };

      let req = http.get(options, (res) => {
        res.setEncoding('utf8');
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {//content not found
            resolve(contentId);
          }

          let parsed = JSON.parse(body);
          let revisionId = 1;
          if (parsed.revisions !== undefined && parsed.revisions.length > 0 && parsed.revisions[0] !== null) {
            revisionId = (parsed.active) ? parsed.active : (parsed.revisions.length - 1);
          }
          resolve(contentId + '-' + revisionId);
        });
      });
      req.on('error', (e) => {
        console.log('problem with request: ' + e.message);
        reject(e);
      });
    }
  });

  return myPromise;
}
