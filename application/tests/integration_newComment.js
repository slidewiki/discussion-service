/* eslint dot-notation: 0, no-unused-vars: 0 */
'use strict';

//Mocking is missing completely TODO add mocked objects

describe('REST API', () => {

  let server;

  beforeEach((done) => {
    //Clean everything up before doing new tests
    Object.keys(require.cache).forEach((key) => delete require.cache[key]);
    require('chai').should();
    let hapi = require('hapi');
    server = new hapi.Server();
    server.connection({
      host: 'localhost',
      port: 3000
    });
    require('../routes.js')(server);
    done();
  });

  let comment = {
    content_id: '000000000000000000000000-0',
    content_kind: 'slide',
    title: 'Dummy',
    text: 'dummy',
    user_id: '000000000000000000000000',
    is_activity: false
  };
  let options = {
    method: 'POST',
    url: '/comment/new',
    payload: comment,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  context('when creating a comment it', () => {
    it('should reply it', (done) => {
      server.inject(options, (response) => {
        response.should.be.an('object').and.contain.keys('statusCode','payload');
        // console.log(response.statusCode, response.payload);
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('content_id', 'timestamp', 'user_id');
        payload.title.should.equal('Dummy');
        payload.user_id.should.equal('000000000000000000000000');
        done();
      });
    });
  });
});
