'use strict';

const co = require('../common');

module.exports = {
  'activities': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_ACTIVITIES)) ? process.env.SERVICE_URL_ACTIVITIES : 'activitiesservice.experimental.slidewiki.org',
    port: 80
  },
  'notification': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_NOTIFICATION)) ? process.env.SERVICE_URL_NOTIFICATION : 'notificationservice.experimental.slidewiki.org',
    port: 80
  },
  'user': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_USER)) ? process.env.SERVICE_URL_USER : 'userservice.experimental.slidewiki.org',
    port: 80
  },
  'deck': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_DECK)) ? process.env.SERVICE_URL_DECK : 'deckservice.experimental.slidewiki.org',
    port: 80
  }
};
