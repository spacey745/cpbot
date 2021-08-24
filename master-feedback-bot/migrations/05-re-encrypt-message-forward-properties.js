import _ from 'lodash';
import {MessageForward} from '../src/db';

/**
 * Re-encrypt message forward properties
 */
export async function up() {
  const messageForwards = await MessageForward.find();
  for (const messageForward of messageForwards) {
    await messageForward.updateOne(_.omit(messageForward.toObject(), '_id'));
  }
}
