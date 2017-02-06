'use strict';

const co = require('../common');

module.exports = {
  'deck': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_DECK)) ? process.env.SERVICE_URL_DECK : 'http://deckservice'
  },
  'activities': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_ACTIVITIES)) ? process.env.SERVICE_URL_ACTIVITIES : 'http://activitiesservice'
  },
  'notification': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_NOTIFICATION)) ? process.env.SERVICE_URL_NOTIFICATION : 'http://notificationservice'
  },
  'user': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_USER)) ? process.env.SERVICE_URL_USER : 'http://userservice'
  }
};
