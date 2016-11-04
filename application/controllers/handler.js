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
      res.on('data', (chunk) => {
        // console.log('Response: ', chunk);
        let newActivity = JSON.parse(chunk);
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

//Send request to insert new notification
function createNotification(activity) {
  //TODO find list of subscribed users
  // if (activity.content_id.split('-')[0] === '8') {//current dummy user is subscribed to this content_id

  let notification = activity;
  notification.subscribed_user_id = activity.content_owner_id;
  notification.activity_id = activity.id;

  delete notification.timestamp;
  delete notification.author;
  delete notification.id;

  let data = JSON.stringify(notification);
  let options = {
    host: Microservices.notification.uri,
    port: 80,
    path: '/notification/new',
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
    res.on('data', (chunk) => {
      // console.log('Response: ', chunk);
    });
  });
  req.on('error', (e) => {
    console.log('problem with request: ' + e.message);
  });
  req.write(data);
  req.end();
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
        commentDB.insert(request.payload).then((inserted) => {
          if (co.isEmpty(inserted.ops) || co.isEmpty(inserted.ops[0]))
            throw inserted;
          else {
            inserted.ops[0].content_name = contentTitleAndOwner.title;
            inserted.ops[0].content_owner_id = contentTitleAndOwner.ownerId;
            if (inserted.ops[0].is_activity === undefined || inserted.ops[0].is_activity === true) {//insert activity if not test initiated

              createActivity(inserted.ops[0])
                .then((activity) => {
                  createNotification(activity);
                }).catch((error) => {
                  request.log('error', error);
                  reply(boom.badImplementation());
                });
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
    //Clean collection and insert mockup comments - only if request.params.id === 0
    return initMockupData(request.params.id)
      .then(() => commentDB.getAll(content_kind, encodeURIComponent(request.params.id))
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
      })).catch((error) => {
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
    return commentDB.getCount(request.params.content_kind, encodeURIComponent(request.params.id))
      .then((count) => {
        reply (count);
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

//Delete all and insert mockup data
function initMockupData(identifier) {
  if (identifier === '000000000000000000000000') {//create collection, delete all and insert mockup data only if the user has explicitly sent 000000000000000000000000
    return commentDB.createCollection()
      .then(() => commentDB.deleteAll())
      .then(() => insertMockupData());
  }
  return new Promise((resolve) => {resolve (1);});
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
      if (res.statusCode === '404') {//user not found
        comment.author = {
          id: comment.user_id,
          username: 'unknown',
          avatar: ''
        };
        resolve(comment);
      }
      // console.log('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      let body = '';
      res.on('data', (chunk) => {
        // console.log('Response: ', chunk);
        body += chunk;
      });
      res.on('end', () => {
        let parsed = JSON.parse(body);
        comment.author = {
          id: comment.user_id,
          username: parsed.username,
          avatar: parsed.picture
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
      if (res.statusCode === '404') {//content not found
        resolve({title: '', ownerId: '0'});
      }
      // console.log('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      let body = '';
      res.on('data', (chunk) => {
        // console.log('Response: ', chunk);
        body += chunk;
      });
      res.on('end', () => {
        let parsed = JSON.parse(body);
        let title = '';
        let ownerId = 0;
        let contentIdParts = comment.content_id.split('-');
        let contentRevisionId = (contentIdParts.length > 1) ? contentIdParts[contentIdParts.length - 1] : undefined;

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
            }
          }
        }
        resolve({title: title, ownerId: String(ownerId)});
      });
    });
    req.on('error', (e) => {
      console.log('problem with request: ' + e.message);
      reject(e);
    });
  });

  return myPromise;
}

// function getMockupAuthor(userId) {
//   let author = authorsMap.get(userId);//insert author data
//   if (author === undefined) {
//     author = authorsMap.get('112233445566778899000000');
//   }
//   return author;
// }

//Insert mockup data to the collection
function insertMockupData() {
  let comment1 = {
    content_id: '8-1',
    content_kind: 'slide',
    title: 'Congrats',
    text: 'Kudos, very good presentation, I\'ll spread the word!',
    user_id: '112233445566778899000001'
  };
  let ins1 = commentDB.insert(comment1);
  let ins2 = ins1.then((ins1) => {
    let reply1 = {
      content_id: '8-1',
      content_kind: 'slide',
      title: 'Agreed',
      text: '^^',
      user_id: '112233445566778899000002',
      parent_comment:String(ins1.ops[0]._id)
    };
    let reply2 = {
      content_id: '8-1',
      content_kind: 'slide',
      title: 'Yeah',
      text: '+1',
      user_id: '112233445566778899000003',
      parent_comment: String(ins1.ops[0]._id)
    };

    return commentDB.insert(reply1).then(() => commentDB.insert(reply2));
  });

  let comment2 = {
    content_id: '8-1',
    content_kind: 'slide',
    title: 'Simply the best',
    text: 'The best presentation I have seen so far on this subject',
    user_id: '112233445566778899000004'
  };
  let ins4 = ins2.then(() => commentDB.insert(comment2));
  let comment3 = {
    content_id: '8-1',
    content_kind: 'slide',
    title: 'Keep up the good work',
    text: 'Slide 54 could use some more details.\nGreat presentation though, keep on truckin!',
    user_id: '112233445566778899000005'
  };
  let ins5 = ins4.then(() => commentDB.insert(comment3));
  return ins5.then((ins5) => {
    let reply3 = {
      content_id: '8-1',
      content_kind: 'slide',
      title: 'Nitpicker!',
      text: 'Damn nitpickers, everyone\'s a critic these days!',
      user_id: '112233445566778899000006',
      parent_comment: String(ins5.ops[0]._id)
    };
    return commentDB.insert(reply3);
  });
}
//
// let authorsMap = new Map([
//   ['112233445566778899000001', {
//     id: 7,
//     username: 'Dejan P.',
//     avatar: '/assets/images/mock-avatars/deadpool_256.png'
//   }],
//   ['112233445566778899000002', {
//     id: 8,
//     username: 'Nikola T.',
//     avatar: '/assets/images/mock-avatars/man_512.png'
//   }],
//   ['112233445566778899000003', {
//     id: 9,
//     username: 'Marko B.',
//     avatar: '/assets/images/mock-avatars/batman_512.jpg'
//   }],
//   ['112233445566778899000004', {
//     id: 10,
//     username: 'Valentina J.',
//     avatar: '/assets/images/mock-avatars/ninja-simple_512.png'
//   }],
//   ['112233445566778899000005', {
//     id: 11,
//     username: 'Voice in the crowd',
//     avatar: '/assets/images/mock-avatars/anon_256.jpg'
//   }],
//   ['112233445566778899000006', {
//     id: 12,
//     username: 'SlideWiki FTW',
//     avatar: '/assets/images/mock-avatars/spooky_256.png'
//   }],
//   ['112233445566778899000000', {
//     id: 13,
//     username: 'Dutch',
//     avatar: '/assets/images/mock-avatars/dgirl.jpeg'
//   }]
// ]);

// let slideNameMap = new Map([
//   ['7', 'SlideWiki Documentation'],
//   ['8', 'Introduction'],
//   ['14', 'Motivation'],
//   ['16', 'SlideWiki for Humanity'],
//   ['17', 'Feature Overview'],
//   ['18', 'How is SlideWiki different?'],
//   ['9', 'Collaborative authoring of presentations'],
//   ['10', 'Revisioning'],
//   ['11', 'Persistent URL Scheme'],
//   ['153', 'Test'],
//   ['19', 'Visibility, Licensing and Attribution'],
//   ['20', 'Editor Groups'],
//   ['36', 'Other features'],
//   ['37', 'others'],
//   ['43', 'others2'],
//   ['34', 'Branching'],
//   ['35', 'Branching'],
//   ['23', 'Slide editing'],
//   ['24', 'Structuring a presentation'],
//   ['25', 'Questionnaires'],
//   ['26', 'Questionnaires'],
//   ['27', 'Supporting Organizations']
// ]);
