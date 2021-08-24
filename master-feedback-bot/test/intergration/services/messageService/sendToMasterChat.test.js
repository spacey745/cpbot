import _ from 'lodash';
import Chance from 'chance';
import {botConfig} from 'config';
import nock from 'nock';
import sinon from 'sinon';
import cleanStateBetweenTests from '../../../cleanStateBetweenTests';
import {MessageLevels, sendToMasterChat, TELEGRAM_MESSAGE_TEXT_LIMIT} from '../../../../src/services/messageService';

const chance = new Chance();

describe('Message Service: Send to Master Chat Tests', () => {
  cleanStateBetweenTests();

  let sendMessageStub;

  before('spy console.log()', () => {
    sinon.spy(console, 'log');
  });

  before('stub telegram services', () => {
    sendMessageStub = sinon.stub();

    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/sendMessage')
      .reply((uri, body) => {
        sendMessageStub(body);
        return [200, chance.telegram.httpResponse({result: chance.telegram.message()})];
      })
      .persist();
  });

  beforeEach('reset stubs history', () => {
    sinon.resetHistory();
  });

  it('should require "level"', async () => {
    const text = chance.sentence();
    await sendToMasterChat(undefined, text).should.be.rejectedWith('The "level" is required');
  });

  it('should require a specific "level" value', async () => {
    const level = chance.word();
    const text = chance.sentence();
    await sendToMasterChat(level, text).should.be.rejectedWith(`The "level" must be one of ${_.values(MessageLevels)}`);
  });

  it('should require "text"', async () => {
    const level = chance.pickone(_.values(MessageLevels));
    await sendToMasterChat(level, undefined).should.be.rejectedWith('The "text" is required');
  });

  it('should send a message to master chat', async () => {
    const level = chance.pickone(_.values(MessageLevels));
    const text = chance.sentence();

    await sendToMasterChat(level, text);

    const expectedMeta = {botName: botConfig.DB_TABLE};
    sinon.assert.calledOnceWithExactly(console.log, level, text, expectedMeta);
    sinon.assert.calledOnceWithExactly(sendMessageStub, {
      'chat_id': botConfig.MASTER_ADMIN_GROUP_ID,
      'text': `${level} ${text} ${JSON.stringify(expectedMeta)}`,
    });
  });

  it('should send a message to master chat with meta', async () => {
    const level = chance.pickone(_.values(MessageLevels));
    const text = chance.sentence();
    const meta = {[chance.word()]: chance.word()};

    await sendToMasterChat(level, text, meta);

    const expectedMeta = {botName: botConfig.DB_TABLE, ...meta};
    sinon.assert.calledOnceWithExactly(console.log, level, text, expectedMeta);
    sinon.assert.calledOnceWithExactly(sendMessageStub, {
      'chat_id': botConfig.MASTER_ADMIN_GROUP_ID,
      'text': `${level} ${text} ${JSON.stringify(expectedMeta)}`,
    });
  });

  it('should cut messages greater than telegram text limit', async () => {
    const level = chance.pickone(_.values(MessageLevels));
    const text = chance.word({length: TELEGRAM_MESSAGE_TEXT_LIMIT});
    const meta = {[chance.word()]: chance.word()};

    await sendToMasterChat(level, text, meta);

    const expectedMeta = {botName: botConfig.DB_TABLE, ...meta};
    sinon.assert.calledOnceWithExactly(console.log, level, text, expectedMeta);
    sinon.assert.calledOnceWithExactly(sendMessageStub, {
      'chat_id': botConfig.MASTER_ADMIN_GROUP_ID,
      'text': `${level} ${text} ${JSON.stringify(expectedMeta)}`.substring(0, TELEGRAM_MESSAGE_TEXT_LIMIT - 3) + '...',
    });
  });
});
