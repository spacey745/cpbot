import Chance from 'chance';
import {botConfig} from 'config';
import request from 'supertest';
import sinon from 'sinon';
import {app} from '../../../../server';
import cleanStateBetweenTests from '../../../cleanStateBetweenTests';
import * as messageService from '../../../../src/services/messageService';

const {ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID} = botConfig;
const chance = new Chance();

describe('Telegram Service: Bot Edited Message Event Tests', () => {
  cleanStateBetweenTests();

  before('stub message service', () => {
    sinon.stub(messageService, 'editForwardedMessage').resolves();
  });

  beforeEach('reset stubs history', () => {
    sinon.resetHistory();
  });

  it('should ignore a message is edited from a not admin chat', async () => {
    const message = chance.telegram.message({
      reply_to_message: chance.telegram.message(),
    });

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({edited_message: message}));
    res.status.should.eql(200);

    sinon.assert.notCalled(messageService.editForwardedMessage);
  });

  it('should ignore a message which is not a reply to another message', async () => {
    const chatId = chance.pickone([ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID]);
    const message = chance.telegram.message({
      chat: {
        id: chatId,
      },
    });

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({edited_message: message}));
    res.status.should.eql(200);

    sinon.assert.notCalled(messageService.editForwardedMessage);
  });

  it('should edit a message', async () => {
    const chatId = chance.pickone([ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID]);
    const message = chance.telegram.message({
      chat: {
        id: chatId,
      },
      reply_to_message: chance.telegram.message(),
    });

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({edited_message: message}));
    res.status.should.eql(200);

    sinon.assert.calledOnceWithExactly(messageService.editForwardedMessage, message);
  });
});
