// example unit tests
'use strict';

//Mocking is missing completely TODO add mocked objects

describe('Database', () => {

  let db, helper; //expect

  beforeEach((done) => {
    //Clean everything up before doing new tests
    Object.keys(require.cache).forEach((key) => delete require.cache[key]);
    require('chai').should();
    let chai = require('chai');
    let chaiAsPromised = require('chai-as-promised');
    chai.use(chaiAsPromised);
    //expect = require('chai').expect;
    db = require('../database/commentDatabase.js');
    helper = require('../database/helper.js');
    helper.cleanDatabase()
      .then(() => done())
      .catch((error) => done(error));
  });

  context('when having an empty database', () => {
    it('should return null when requesting a non existant comment', () => {
      return db.get('asd7db2daasd').should.be.fulfilled.and.become(null);
    });

    it('should return empty array when requesting a discussion for non existant content', () => {
      return db.getAll('asd7db2daasd').should.be.fulfilled.and.become([]);
    });

    it('should return empty array when requesting all comments in the collection', () => {
      return db.getAllFromCollection().should.be.fulfilled.and.become([]);
    });

    it('should return the comment when inserting one', () => {
      let comment = {
        content_id: '112233445566778899000671',
        content_kind: 'slide',
        title: 'Dummy',
        text: 'dummy',
        user_id: '000000000000000000000000',
        is_activity: false
      };
      let res = db.insert(comment);
      return Promise.all([
        res.should.be.fulfilled.and.eventually.not.be.empty,
        res.should.eventually.have.property('ops').that.is.not.empty,
        res.should.eventually.have.deep.property('ops[0]').that.has.all.keys('_id', 'title', 'text', 'timestamp', 'content_id', 'content_kind', 'user_id', 'is_activity'),
        res.should.eventually.have.deep.property('ops[0].title', comment.title)
      ]);
    });

    it('should get an previously inserted comment', () => {
      let comment = {
        content_id: '112233445566778899000671',
        content_kind: 'slide',
        title: 'Dummy',
        text: 'dummy',
        user_id: '000000000000000000000000',
        is_activity: false
      };
      let ins = db.insert(comment);
      let res = ins.then((ins) => db.get(ins.ops[0]._id));
      return Promise.all([
        res.should.be.fulfilled.and.eventually.not.be.empty,
        res.should.eventually.have.all.keys('_id', 'title', 'text', 'timestamp', 'content_id', 'content_kind', 'user_id', 'is_activity'),
        res.should.eventually.have.property('text', comment.text)
      ]);
    });

    it('should be able to replace a previously inserted comment', () => {
      let comment = {
        content_id: '112233445566778899000671',
        content_kind: 'slide',
        title: 'Dummy',
        text: 'dummy',
        user_id: '000000000000000000000000',
        is_activity: false
      };
      let comment2 = {
        content_id: '112233445566778899000671',
        content_kind: 'slide',
        title: 'Dummy2',
        text: 'dummy2',
        user_id: '000000000000000000000000',
        is_activity: false
      };
      let ins = db.insert(comment);
      let res = ins.then((ins) => db.replace(ins.ops[0]._id, comment2));
      res = ins.then((ins) => db.get(ins.ops[0]._id));
      return Promise.all([
        res.should.be.fulfilled.and.eventually.not.be.empty,
        res.should.eventually.have.all.keys('_id', 'title', 'text', 'timestamp', 'content_id', 'content_kind', 'user_id', 'is_activity'),
        res.should.eventually.have.property('title', 'Dummy2')
      ]);
    });

    it('should be able to delete a previously inserted comment', () => {
      let comment = {
        content_id: '112233445566778899000671',
        content_kind: 'slide',
        title: 'Dummy',
        text: 'dummy',
        user_id: '000000000000000000000000',
        is_activity: false
      };

      let ins = db.insert(comment);
      let res = ins.then((ins) => db.delete(ins.ops[0]._id));
      return ins.then((ins) => db.get(ins.ops[0]._id)).should.be.fulfilled.and.become(null);
    });

    it('should be able to delete all comments for the content', () => {
      let comment = {
        content_id: '112233445566778899000671',
        content_kind: 'slide',
        title: 'Dummy',
        text: 'dummy',
        user_id: '000000000000000000000000',
        is_activity: false
      };
      let comment2 = {
        content_id: '112233445566778899000671',
        content_kind: 'slide',
        title: 'Dummy2',
        text: 'dummy2',
        user_id: '000000000000000000000000',
        is_activity: false
      };
      let ins = db.insert(comment);
      let res = ins.then((ins) => db.insert(comment2));
      let res2 = res.then((res) => db.deleteAllWithContentID('112233445566778899000671'));
      return res2.then((res2) => db.getAll('112233445566778899000671')).should.be.fulfilled.and.become([]);
    });
    it('should be able to delete all comments from the collection', () => {
      let comment = {
        content_id: '112233445566778899000671',
        content_kind: 'slide',
        title: 'Dummy',
        text: 'dummy',
        user_id: '000000000000000000000000',
        is_activity: false
      };
      let comment2 = {
        content_id: '112233445566778899000671',
        content_kind: 'slide',
        title: 'Dummy2',
        text: 'dummy2',
        user_id: '000000000000000000000000',
        is_activity: false
      };
      let ins = db.insert(comment);
      let res = ins.then((ins) => db.insert(comment2));
      let res2 = res.then((res) => db.deleteAll());
      return res2.then((res2) => db.getAllFromCollection()).should.be.fulfilled.and.become([]);
    });
  });
});
