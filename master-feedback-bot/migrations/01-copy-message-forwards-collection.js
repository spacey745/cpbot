import _ from 'lodash';
import {getMsgSendersRef} from '../src/helpers/firebaseHelper';
import {MessageForward} from '../src/db';

/**
 * Copy "messageforwards" data from Firebase to Mongodb
 */
export async function up() {
  const dbMessageForwards = [];

  const snapshot = await getMsgSendersRef().get();
  snapshot.forEach((child) => {
    const adminGroupId = child.key;
    const chatIdByMessageId = child.val();
    _.forEach(chatIdByMessageId, (tgUserId, messageId) => {
      dbMessageForwards.push({
        fromUserId: tgUserId,
        fromChatId: tgUserId,
        toChatId: adminGroupId,
        toMessageId: messageId,
      });
    });
  });

  for (const dbMessageForward of dbMessageForwards) {
    const existingMessageForward = await MessageForward.findOne(_.pick(dbMessageForward, 'toChatId', 'toMessageId'));
    if (existingMessageForward) {
      console.log(
        `SKIPPED: A message forward with "toChatId" = ${dbMessageForward.toChatId} and "toMessageId" = ${dbMessageForward.toMessageId} already exists`,
      );
      continue;
    }

    console.log(
      `ADD: Create a new message forward with "toChatId" = ${dbMessageForward.toChatId} and "toMessageId" = ${dbMessageForward.toMessageId}`,
    );
    await MessageForward.create(dbMessageForward);
  }
}
