import _ from 'lodash';
import {User} from '../src/db';

/**
 * Re-encrypt user properties
 */
export async function up() {
  const users = await User.find();
  for (const user of users) {
    await user.updateOne(_.omit(user.toObject(), '_id'));
  }
}
