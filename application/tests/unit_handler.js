// example unit tests
'use strict';

//Mocking is missing completely TODO add mocked objects

describe('Discussion service', () => {

  let handler, expect;

  const content_id = '000000000000000000000000-0';
  const content_kind = 'slide';
  beforeEach((done) => {
    //Clean everything up before doing new tests
    Object.keys(require.cache).forEach((key) => delete require.cache[key]);
    require('chai').should();
    let chai = require('chai');
    let chaiAsPromised = require('chai-as-promised');
    chai.use(chaiAsPromised);
    expect = require('chai').expect;
    handler = require('../controllers/handler.js');
    done();
  });

  const comment = {
    content_id: content_id,
    content_kind: content_kind,
    title: 'Unit_handler_dummy',
    text: 'handler_dummy',
    user_id: '000000000000000000000000',
    is_activity: false
  };

  context('Using all exported functions - ', () => {
    it('Add comment', () => {
      let req = {
        payload: comment
      };

      return handler.newComment(req, (result) => {
        expect(result.id).to.not.equal(undefined);
        return;
      })
      .catch((Error) => {
        console.log(Error);
        throw Error;
        expect(1).to.equals(2);
      });
    });
    it('Get comment', () => {
      let req = {
      };

      return handler.getAllDiscussions(req, (result) => {
        let comments = JSON.parse(result);
        if (comments.length === 0) {
          expect(1).to.equals(2);
        }
        let commentId = comments[0].id;
        let req = {
          params: {
            id: commentId
          }
        };

        return handler.getComment(req, (result2) => {
          expect(String(result2.id)).to.equal(String(commentId));
          expect(result2.title).to.equal(comment.title);
          return;
        })
        .catch((Error) => {
          console.log(Error);
          throw Error;
          expect(1).to.equals(2);
        });
      }).catch((Error) => {
        console.log(Error);
        throw Error;
        expect(1).to.equals(2);
      });
    });
    it('Update comment', () => {
      let req = {
      };

      return handler.getAllDiscussions(req, (result) => {
        let comments = JSON.parse(result);
        if (comments.length === 0) {
          expect(1).to.equals(2);
        }
        let commentId = comments[0].id;

        const comment2 = {
          content_id: content_id,
          content_kind: content_kind,
          title: 'Updated_Unit_handler_dummy',
          text: 'handler_dummy',
          user_id: '000000000000000000000000',
          is_activity: false
        };
        let req = {
          params: {
            id: commentId
          },
          payload: comment2
        };

        return handler.updateComment(req, (result2) => {

          return handler.getComment(req, (result3) => {
            expect(String(result3.id)).to.equal(String(commentId));
            expect(result3.title).to.equal(comment2.title);
            return;
          }).catch((Error) => {
            console.log(Error);
            throw Error;
            expect(1).to.equals(2);
          });
        }).catch((Error) => {
          console.log(Error);
          throw Error;
          expect(1).to.equals(2);
        });
      })
      .catch((Error) => {
        console.log(Error);
        throw Error;
        expect(1).to.equals(2);
      });
    });
    it('Count comments', () => {
      let req = {
        params: {
          id: content_id,
          content_kind: content_kind
        }
      };
      return handler.getDiscussionCount(req, (result) => {
        expect(result).to.equal(1);
        return;
      })
      .catch((Error) => {
        console.log('Error', Error);
        throw Error;
        expect(1).to.equals(2);
      });
    });
    it('Delete comment', () => {
      let req = {
      };
      return handler.getAllDiscussions(req, (result) => {
        let comments = JSON.parse(result);
        if (comments.length === 0) {
          expect(1).to.equals(2);
        }
        let commentId = comments[0].id;
        let req = {
          payload: {
            id: commentId
          }
        };
        return handler.deleteComment(req, (result2) => {
          expect(result2.msg).to.not.equal(undefined);
          return;
        })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
          expect(1).to.equals(2);
        });
      })
      .catch((Error) => {
        console.log('Error', Error);
        throw Error;
        expect(1).to.equals(2);
      });
    });
  });
});
