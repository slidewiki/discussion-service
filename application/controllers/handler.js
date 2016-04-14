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
      else
        reply(co.rewriteID(comment));
    }).catch((error) => {

      request.log('error', error);
      reply(boom.badImplementation());
    });
  },

  //Create Comment with new id and payload or return INTERNAL_SERVER_ERROR
  newComment: function(request, reply) {
    commentDB.insert(request.payload).then((inserted) => {
      //console.log('inserted: ', inserted);
      if (co.isEmpty(inserted.ops[0]) || co.isEmpty(inserted.ops[0]))
        throw inserted;
      else
        reply(co.rewriteID(inserted.ops[0]));
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

  getDiscussion: function(request, reply) {
    // reply(boom.notImplemented);

    //----mockup:start
    let now = Date.now();
    function timeFromNow(now, hours, mins) {
      return now - 60000*mins - 3600000*hours;
    }
    let discussion = [
      {
        id: 0,
        author: {
          id: 7,
          username: 'Vuk M.',
          avatar: '/assets/images/mock-avatars/deadpool_256.png'
        },
        title: 'Congrats',
        text: 'Kudos, very good presentation, I\'ll spread the word!',
        date: timeFromNow(now, 11, 35),
        replies: [
          {
            id: 1,
            author: {
              id: 8,
              username: 'Dejan P.',
              avatar: '/assets/images/mock-avatars/man_512.png'
            },
            title: 'Agreed',
            text: '^^',
            date: timeFromNow(now, 10, 0)
          },
          {
            id: 2,
            author: {
              id: 9,
              username: 'Nikola T.',
              avatar: '/assets/images/mock-avatars/batman_512.jpg'
            },
            title: 'Yeah',
            text: '+1',
            date: timeFromNow(now, 9, 45)
          }
        ]
      },
      {
        id: 3,
        author: {
          id: 10,
          username: 'Marko B.',
          avatar: '/assets/images/mock-avatars/ninja-simple_512.png'
        },
        title: 'Simply the best',
        text: 'Best presentation I have seen so far on this subject',
        date: timeFromNow(now, 9, 0)
      },
      {
        id: 4,
        author: {
          id: 11,
          username: 'Voice in the crowd',
          avatar: '/assets/images/mock-avatars/anon_256.jpg'
        },
        title: 'Keep up the good work',
        text: 'Slide 54 could use some more details.\nGreat presentation though, keep on truckin!',
        date: timeFromNow(now, 9, 0),
        replies: [
          {
            id: 5,
            author: {
              id: 12,
              username: 'SlideWiki FTW',
              avatar: '/assets/images/mock-avatars/spooky_256.png'
            },
            title: 'Nitpicker!',
            text: 'Damn nitpickers, everyone\'s a critic these days!',
            date: timeFromNow(now, 8, 45)
          }
        ]
      }
    ];
    console.log(discussion);
    //----mockup:end
    reply(discussion);
  }
};
