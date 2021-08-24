import _ from 'lodash';
import Chance from 'chance';
import {botConfig} from 'config';
import request from 'supertest';
import nock from 'nock';
import sinon from 'sinon';
import {app} from '../../../../server';
import cleanStateBetweenTests from '../../../cleanStateBetweenTests';
import * as messageService from '../../../../src/services/messageService';
import * as userService from '../../../../src/services/userService';

const {MessageLevels} = messageService;
const chance = new Chance();

describe('Telegram Service: Bot Message Event Tests', () => {
  cleanStateBetweenTests();

  let sendMessageStub;

  before('stub telegram requests', () => {
    sendMessageStub = sinon.stub();

    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/sendMessage')
      .reply((uri, body) => {
        sendMessageStub(body);
        return [200, chance.telegram.httpResponse({result: chance.telegram.message()})];
      })
      .persist();
  });

  before('stub message service', () => {
    sinon.stub(messageService, 'sendToMasterChat').resolves();
  });

  before('stub user service', () => {
    sinon.stub(userService, 'sendUserInfo').resolves();
  });

  beforeEach('reset stubs history', () => {
    sinon.resetHistory();
  });

  it('should ignore messages are sent to admin mirror chat', async () => {
    const newMessage = chance.telegram.message({
      chat: {
        id: botConfig.ADMIN_MIRROR_GROUP_ID,
      },
    });

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({message: newMessage}));
    res.status.should.eql(200);

    sinon.assert.notCalled(messageService.sendToMasterChat);
    sinon.assert.notCalled(sendMessageStub);
  });

  it('should notify master admin when a new group chats created', async () => {
    const message = chance.telegram.message({
      group_chat_created: true,
    });
    delete message.text;

    const res = await request(app).post('/').send(chance.telegram.update({message}));
    res.status.should.eql(200);

    sinon.assert.calledOnceWithExactly(
      messageService.sendToMasterChat,
      MessageLevels.WARN,
      'A bot was added to a new group chat',
      {chatId: message.chat.id},
    );
  });

  it('should notify master admin when a group chat was migrated to another id', async () => {
    const message = chance.telegram.message({
      migrate_to_chat_id: chance.natural(),
    });
    delete message.text;

    const res = await request(app).post('/').send(chance.telegram.update({message}));
    res.status.should.eql(200);

    sinon.assert.calledOnceWithExactly(
      messageService.sendToMasterChat,
      MessageLevels.WARN,
      'A group chat was migrated to another id',
      {fromChatId: message.chat.id, toChatId: message.migrate_to_chat_id},
    );
  });

  it('should ignore the second group chat message about migration to another id', async () => {
    const message = chance.telegram.message({
      migrate_from_chat_id: chance.natural(),
    });
    delete message.text;

    const res = await request(app).post('/').send(chance.telegram.update({message}));
    res.status.should.eql(200);

    sinon.assert.notCalled(messageService.sendToMasterChat);
    sinon.assert.notCalled(sendMessageStub);
  });

  it('should notify master admin when a message with unsupported update type is sent', async () => {
    const message = chance.telegram.message({
      poll: {},
    });
    delete message.text;

    const res = await request(app).post('/').send(chance.telegram.update({message}));
    res.status.should.eql(200);

    sinon.assert.calledOnceWithExactly(
      messageService.sendToMasterChat,
      MessageLevels.WARN,
      'A message with not allowed update type was sent',
      {userId: message.from.id, chatId: message.chat.id, messageKeys: _.keys(message)},
    );
  });

  for (const command of ['/info', '/инфо']) {
    describe(`when a user send "${command}" command to a chat`, () => {
      it('should not send user info for a general chat', async () => {
        const message = chance.telegram.message({
          reply_to_message: chance.telegram.message(),
          text: command,
        });

        const res = await request(app).post('/').send(chance.telegram.update({message}));
        res.status.should.eql(200);

        sinon.assert.notCalled(userService.sendUserInfo);
      });

      it('should not send user info for a simple message', async () => {
        const message = chance.telegram.message({
          chat: {
            id: botConfig.ADMIN_GROUP_ID,
          },
          text: command,
        });

        const res = await request(app).post('/').send(chance.telegram.update({message}));
        res.status.should.eql(200);

        sinon.assert.notCalled(userService.sendUserInfo);
      });

      it('should send user info when an admin replies to a user message in the admin chat', async () => {
        const message = chance.telegram.message({
          chat: {
            id: botConfig.ADMIN_GROUP_ID,
          },
          reply_to_message: chance.telegram.message(),
          text: command,
        });

        const res = await request(app).post('/').send(chance.telegram.update({message}));
        res.status.should.eql(200);

        sinon.assert.calledOnceWithExactly(
          userService.sendUserInfo,
          [botConfig.ADMIN_GROUP_ID, botConfig.ADMIN_MIRROR_GROUP_ID],
          message.reply_to_message,
        );
      });

      it('should send user info when an admin replies to a user message in the favorite admin chat', async () => {
        const message = chance.telegram.message({
          chat: {
            id: botConfig.ADMIN_FAV_GROUP_ID,
          },
          reply_to_message: chance.telegram.message(),
          text: command,
        });

        const res = await request(app).post('/').send(chance.telegram.update({message}));
        res.status.should.eql(200);

        sinon.assert.calledOnceWithExactly(
          userService.sendUserInfo,
          [botConfig.ADMIN_FAV_GROUP_ID, botConfig.ADMIN_MIRROR_GROUP_ID],
          message.reply_to_message,
        );
      });

      describe('when "ADMIN_MIRROR_GROUP_ID" config is not defined', () => {
        let originalMirrorChatId;

        beforeEach('clear "ADMIN_MIRROR_GROUP_ID" config', () => {
          originalMirrorChatId = botConfig.ADMIN_MIRROR_GROUP_ID;
          botConfig.ADMIN_MIRROR_GROUP_ID = '';
        });

        afterEach('restore ""ADMIN_MIRROR_GROUP_ID" config', () => {
          botConfig.ADMIN_MIRROR_GROUP_ID = originalMirrorChatId;
        });

        it('should send user info to admin chat only', async () => {
          const message = chance.telegram.message({
            chat: {
              id: botConfig.ADMIN_GROUP_ID,
            },
            reply_to_message: chance.telegram.message(),
            text: command,
          });

          const res = await request(app).post('/').send(chance.telegram.update({message}));
          res.status.should.eql(200);

          sinon.assert.calledOnceWithExactly(
            userService.sendUserInfo,
            [botConfig.ADMIN_GROUP_ID],
            message.reply_to_message,
          );
        });
      });
    });
  }
});
