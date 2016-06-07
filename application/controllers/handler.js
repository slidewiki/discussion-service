/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  commentDB = require('../database/commentDatabase'), //Database functions specific for comments
  co = require('../common');

//Send request to insert new activity
function createActivity(comment) {
  let myPromise = new Promise((resolve, reject) => {
    let http = require('http');
    const activityType = (comment.parent_comment === undefined) ? 'comment' : 'reply';
    let data = JSON.stringify({
      activity_type: activityType,
      user_id: comment.user_id,
      content_id: comment.content_id,
      content_kind: comment.content_kind,
      content_name: slideNameMap.get(comment.content_id),//TODO get real content_name
      comment_info: {
        comment_id: comment._id,
        text: comment.title
      }
    });

    const Microservices = require('../configs/microservices');
    let options = {
      //CHANGES FOR LOCALHOST IN PUPIN (PROXY)
      // host: 'proxy.rcub.bg.ac.rs',
      // port: 8080,
      // path: 'http://activitiesservice.manfredfris.ch/activity/new',
      // path: 'http://' + Microservices.activities.uri + '/activity/new',

      // host: 'activitiesservice.manfredfris.ch',
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
  let http = require('http');

  //TODO find list of subscribed users
  if (activity.content_id === '575060ae4bc68d1000ea952b') {//current dummy user is subscribed to this content_id

    let notification = activity;
    notification.subscribed_user_id = '112233445566778899000001';
    notification.activity_id = activity.id;

    delete notification.timestamp;
    delete notification.author;
    delete notification.id;

    let data = JSON.stringify(activity);
    const Microservices = require('../configs/microservices');
    let options = {
      //CHANGES FOR LOCALHOST IN PUPIN (PROXY)
      // host: 'proxy.rcub.bg.ac.rs',
      // port: 8080,
      // path: 'http://activitiesservice.manfredfris.ch/activity/new',
      // path: 'http://' + Microservices.activities.uri + '/activity/new',

      // host: 'activitiesservice.manfredfris.ch',
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
}

module.exports = {
  //Get Comment from database or return NOT FOUND
  getComment: function(request, reply) {
    commentDB.get(encodeURIComponent(request.params.id)).then((comment) => {
      if (co.isEmpty(comment))
        reply(boom.notFound());
      else {
        comment.author = authorsMap.get(comment.user_id);//insert author data
        if (comment.author === undefined) {
          comment.author = authorsMap.get('112233445566778899000000');
        }
        reply(co.rewriteID(comment));
      }
    }).catch((error) => {
      request.log('error', error);
      reply(boom.badImplementation());
    });
  },

  //Create Comment with new id and payload or return INTERNAL_SERVER_ERROR
  newComment: function(request, reply) {
    commentDB.insert(request.payload).then((inserted) => {
      if (co.isEmpty(inserted.ops) || co.isEmpty(inserted.ops[0]))
        throw inserted;
      else {
        if (inserted.ops[0].is_activity === undefined || inserted.ops[0].is_activity === true) {//insert activity if not test initiated
          createActivity(inserted.ops[0]).then((activity) => {
            createNotification(activity);
          }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
          });
        }

        inserted.ops[0].author = authorsMap.get(inserted.ops[0].user_id);//insert author data
        reply(co.rewriteID(inserted.ops[0]));
      }
    }).catch((error) => {
      console.log(error);
      request.log('error', error);
      reply(boom.badImplementation());
    });
  },


  //Update Comment with id id and payload or return INTERNAL_SERVER_ERROR
  updateComment: function(request, reply) {
    commentDB.replace(encodeURIComponent(request.params.id), request.payload).then((replaced) => {
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
    commentDB.delete(encodeURIComponent(request.payload.id)).then(() =>
      reply({'msg': 'comment is successfully deleted...'})
    ).catch((error) => {
      request.log('error', error);
      reply(boom.badImplementation());
    });
  },

  //Delete Discussions with content id id
  deleteDiscussion: function(request, reply) {
    commentDB.deleteAllWithContentID(encodeURIComponent(request.payload.content_id)).then(() =>
      reply({'msg': 'discussion is successfully deleted...'})
    ).catch((error) => {
      request.log('error', error);
      reply(boom.badImplementation());
    });
  },

  //Get All Comments from database for the id in the request
  getDiscussion: function(request, reply) {
    //Clean collection and insert mockup comments - only if request.params.id === 0
    initMockupData(request.params.id)
      .then(() => commentDB.getAll(encodeURIComponent(request.params.id))
      .then((comments) => {
        // if (co.isEmpty(comments))
        //   reply(boom.notFound());
        // else {
        comments.forEach((comment) => {
          co.rewriteID(comment);
        });

        //sort by timestamp
        // comments.sort((comment1, comment2) => {return (comment2.timestamp - comment1.timestamp);});

        let replies = [];
        comments.forEach((comment, index) => {
          comment.author = authorsMap.get(comment.user_id);//insert author data

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

        //remove comments which were inserted as replies
        replies.reverse();
        replies.forEach((i) => {
          comments.splice(i, 1);
        });

        let jsonReply = JSON.stringify(comments);
        reply(jsonReply);

      })).catch((error) => {
        request.log('error', error);
        reply(boom.badImplementation());
      });

  },

  //Get All Comments from database
  getAllDiscussions: function(request, reply) {
    commentDB.getAllFromCollection()
      .then((comments) => {
        comments.forEach((comment) => {
          co.rewriteID(comment);
        });

        let replies = [];
        comments.forEach((comment, index) => {
          comment.author = authorsMap.get(comment.user_id);//insert author data

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

//Insert mockup data to the collection
function insertMockupData() {
  let comment1 = {
    content_id: '575060ae4bc68d1000ea952b',
    content_kind: 'slide',
    title: 'Congrats',
    text: 'Kudos, very good presentation, I\'ll spread the word!',
    user_id: '112233445566778899000001'
  };
  let ins1 = commentDB.insert(comment1);
  let ins2 = ins1.then((ins1) => {
    let reply1 = {
      content_id: '575060ae4bc68d1000ea952b',
      content_kind: 'slide',
      title: 'Agreed',
      text: '^^',
      user_id: '112233445566778899000002',
      parent_comment:String(ins1.ops[0]._id)
    };
    let reply2 = {
      content_id: '575060ae4bc68d1000ea952b',
      content_kind: 'slide',
      title: 'Yeah',
      text: '+1',
      user_id: '112233445566778899000003',
      parent_comment: String(ins1.ops[0]._id)
    };

    return commentDB.insert(reply1).then(() => commentDB.insert(reply2));
  });

  let comment2 = {
    content_id: '575060ae4bc68d1000ea952b',
    content_kind: 'slide',
    title: 'Simply the best',
    text: 'The best presentation I have seen so far on this subject',
    user_id: '112233445566778899000004'
  };
  let ins4 = ins2.then(() => commentDB.insert(comment2));
  let comment3 = {
    content_id: '575060ae4bc68d1000ea952b',
    content_kind: 'slide',
    title: 'Keep up the good work',
    text: 'Slide 54 could use some more details.\nGreat presentation though, keep on truckin!',
    user_id: '112233445566778899000005'
  };
  let ins5 = ins4.then(() => commentDB.insert(comment3));
  return ins5.then((ins5) => {
    let reply3 = {
      content_id: '575060ae4bc68d1000ea952b',
      content_kind: 'slide',
      title: 'Nitpicker!',
      text: 'Damn nitpickers, everyone\'s a critic these days!',
      user_id: '112233445566778899000006',
      parent_comment: String(ins5.ops[0]._id)
    };
    return commentDB.insert(reply3);
  });
}

let authorsMap = new Map([
  ['112233445566778899000001', {
    id: 7,
    username: 'Dejan P.',
    avatar: '/assets/images/mock-avatars/deadpool_256.png'
  }],
  ['112233445566778899000002', {
    id: 8,
    username: 'Nikola T.',
    avatar: '/assets/images/mock-avatars/man_512.png'
  }],
  ['112233445566778899000003', {
    id: 9,
    username: 'Marko B.',
    avatar: '/assets/images/mock-avatars/batman_512.jpg'
  }],
  ['112233445566778899000004', {
    id: 10,
    username: 'Valentina J.',
    avatar: '/assets/images/mock-avatars/ninja-simple_512.png'
  }],
  ['112233445566778899000005', {
    id: 11,
    username: 'Voice in the crowd',
    avatar: '/assets/images/mock-avatars/anon_256.jpg'
  }],
  ['112233445566778899000006', {
    id: 12,
    username: 'SlideWiki FTW',
    avatar: '/assets/images/mock-avatars/spooky_256.png'
  }],
  ['112233445566778899000000', {
    id: 13,
    username: 'Dutch',
    avatar: '/assets/images/mock-avatars/dgirl.jpeg'
  }]
]);
let slideNameMap = new Map([
  ['56', 'Semantic Web'],
  ['575060ae4bc68d1000ea952b', 'Introduction'],
  ['67', 'RDF Data Model'],
  ['57506cbd1ae1bd1000312a70', 'Introduction'],
  ['575039f24bc68d1000ea9525', 'Serialization'],
  ['57503dc14bc68d1000ea9526', 'Examples'],
  ['68', 'SPARQL'],
  ['685', 'Syntax'],
  ['57505e034bc68d1000ea9527', 'Same Slide'],
  ['57505eec4bc68d1000ea952a', 'Same Slide'],
  ['57505e674bc68d1000ea9529', 'Examples'],
  ['574f2bbf81e34010002b7fda', 'Conclusion'],
  ['574f2b2881e34010002b7fd8', 'Future Work'],
  ['574f24e881e34010002b7fd4', 'References'],
  ['574f251081e34010002b7fd6', 'Extra1'],

]);
