import _ from 'lodash';

export const getText = (ctx) => _.get(ctx, 'update.message.text') || _.get(ctx, 'update.message.caption') || '';
export const getOriginalMessageText = (ctx) =>
  _.get(ctx, 'update.message.reply_to_message.text') || _.get(ctx, 'update.message.reply_to_message.caption');
export const getOriginalMessageId = (ctx) => _.get(ctx, 'update.message.reply_to_message.message_id');

export async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

export function cleanUpMessageForStoring(msg) {
  if (!msg) throw new Error('No msg in cleanUpMessageForStoring');
  let cleanMsg = {...msg};
  delete cleanMsg.from;
  delete cleanMsg.chat;
  delete cleanMsg.message_id;
  cleanMsg.messageId = msg.message_id;
  cleanMsg.fromUserId = msg.from.id;
  return cleanMsg;
}

export const isValidText = (ctx) => {
  const txt = getText(ctx);
  return typeof txt === 'string' && txt.charAt(0) !== '/';
};

export const getReplyToMsgId = (message) => {
  return _.get(message, 'reply_to_message.message_id');
};

export const isCBQ = (ctx) => !!_.get(ctx.update, 'callback_query');

export const isEdit = (ctx) => {
  return !!_.get(ctx.update, 'edited_message');
};

/**
 * Halve a message on similar parts by a separator
 *
 * @param {string} message A message to split
 * @param {string} separator A separator to split
 */
function halveBySeparator(message, separator) {
  const messageCharsCount = [...message].length;
  const minBorder = messageCharsCount / 3;
  const maxBorder = (messageCharsCount / 3) * 2;

  let message1 = '';
  let message2 = '';
  for (const part of _.split(message, separator)) {
    const message1WithPart = message1 ? `${message1}${separator}${part}` : part;

    if (!message2 && [...message1WithPart].length <= maxBorder) {
      message1 = message1WithPart;
    } else {
      message2 = message2 ? `${message2}${separator}${part}` : part;
    }
  }

  const message1CharsCount = [...message1].length;
  if (minBorder <= message1CharsCount && message1CharsCount <= maxBorder) {
    return [message1, message2];
  } else {
    return [message];
  }
}

/**
 * Halve a message on similar parts if the message exceeds a limit
 *
 * @param {string} message A message to split
 * @param {number} limit Maximum number of characters in the message
 * @return [string, string, string] An array of strings: message1, message2, recommended separator
 */
export function halveMessage(message, limit) {
  if (!message) {
    return message;
  }

  const messageChars = [...message];
  if (messageChars.length <= limit) {
    return [message];
  }

  if (Math.ceil(limit / messageChars.length) > 2) {
    console.log('A message impossible to halve with a limit', {charsCount: messageChars.length, limit});
    throw new Error('A message impossible to halve with a limit');
  }

  const halvesByNewLine = halveBySeparator(message, '\n');
  if (halvesByNewLine.length === 2) {
    return halvesByNewLine;
  }

  const halvesBySentence = halveBySeparator(message, '. ');
  if (halvesBySentence.length === 2) {
    return [`${halvesBySentence[0]}.`, halvesBySentence[1]];
  }

  const halvesByWord = halveBySeparator(message, ' ');
  if (halvesByWord.length === 2) {
    return [...halvesByWord, '...'];
  }

  return [
    messageChars.slice(0, messageChars.length / 2).join(''),
    messageChars.slice(messageChars.length / 2).join(''),
    '...',
  ];
}

/**
 * Halve a message entities based on provided limit
 *
 * @param {[{offset, length}]} entities A message entities to split
 * @param {number} limit Maximum offset + length value
 * @return [{offset, length}, {offset, length}] A halved message entities
 */
export function halveMessageEntities(entities, limit) {
  if (!entities) {
    return entities;
  }

  const entitiesCopy = _.cloneDeep(entities);
  const leftEntities = [];
  const rightEntities = [];

  for (const entity of entitiesCopy) {
    if (entity.offset + entity.length <= limit) {
      leftEntities.push(entity);
      continue;
    }

    if (entity.offset > limit) {
      rightEntities.push({...entity, offset: entity.offset - limit});
      continue;
    }

    leftEntities.push({...entity, length: limit - entity.offset});
    rightEntities.push({...entity, offset: 0, length: entity.offset + entity.length - limit});
  }
  return [!_.isEmpty(leftEntities) ? leftEntities : undefined, !_.isEmpty(rightEntities) ? rightEntities : undefined];
}
