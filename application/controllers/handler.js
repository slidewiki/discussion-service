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
      else {
        comment.author = authorsMap.get(comment.user_id);//insert author data
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
      //console.log('inserted: ', inserted);
      if (co.isEmpty(inserted.ops) || co.isEmpty(inserted.ops[0]))
        throw inserted;
      else {
        inserted.ops[0].author = authorsMap.get(inserted.ops[0].user_id);//insert author data
        reply(co.rewriteID(inserted.ops[0]));
      }
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

  deleteComment: function(request, reply) {
    commentDB.delete(encodeURIComponent(request.payload.id)).then(() =>
      reply({'msg': 'comment is successfully deleted...'})
    ).catch((error) => {
      request.log('error', error);
      reply(boom.badImplementation());
    });
  },

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

        // let now = Date.now();
        let replies = [];
        comments.forEach((comment, index) => {
          comment.author = authorsMap.get(comment.user_id);//insert author data
          // comment.date = now - comment.timestamp;//insert date
          //move replies to their places
          let parent_comment = comment.parent_comment;
          if (parent_comment !== undefined) {
            comments.forEach((comment2) => {
              if (parent_comment.toString() === comment2.id.toString()) {

                if (comment2.replies === undefined) {//add comment to replies
                  comment2.replies = [];
                }
                comment2.replies.push(comment);
                replies.push(index);
              }
            });
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

  }
};

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
    content_id: '112233445566778899000671',
    content_kind: 'slide',
    title: 'Congrats',
    text: 'Kudos, very good presentation, I\'ll spread the word!',
    user_id: '112233445566778899000001'
  };
  let ins1 = commentDB.insert(comment1);
  let ins2 = ins1.then((ins1) => {
    let reply1 = {
      content_id: '112233445566778899000671',
      content_kind: 'slide',
      title: 'Agreed',
      text: '^^',
      user_id: '112233445566778899000002',
      parent_comment:String(ins1.ops[0]._id)
    };
    let reply2 = {
      content_id: '112233445566778899000671',
      content_kind: 'slide',
      title: 'Yeah',
      text: '+1',
      user_id: '112233445566778899000003',
      parent_comment: String(ins1.ops[0]._id)
    };

    return commentDB.insert(reply1).then(() => commentDB.insert(reply2));
  });

  let comment2 = {
    content_id: '112233445566778899000671',
    content_kind: 'slide',
    title: 'Simply the best',
    text: 'The best presentation I have seen so far on this subject',
    user_id: '112233445566778899000004'
  };
  let ins4 = ins2.then(() => commentDB.insert(comment2));
  let comment3 = {
    content_id: '112233445566778899000671',
    content_kind: 'slide',
    title: 'Keep up the good work',
    text: 'Slide 54 could use some more details.\nGreat presentation though, keep on truckin!',
    user_id: '112233445566778899000005'
  };
  let ins5 = ins4.then(() => commentDB.insert(comment3));
  return ins5.then((ins5) => {
    let reply3 = {
      content_id: '112233445566778899000671',
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
    username: 'Vuk M.',
    avatar: '/assets/images/mock-avatars/deadpool_256.png'
  }],
  ['112233445566778899000002', {
    id: 8,
    username: 'Dejan P.',
    avatar: '/assets/images/mock-avatars/man_512.png'
  }],
  ['112233445566778899000003', {
    id: 9,
    username: 'Nikola T.',
    avatar: '/assets/images/mock-avatars/batman_512.jpg'
  }],
  ['112233445566778899000004', {
    id: 10,
    username: 'Marko B.',
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
  }]
]);
