import _ from 'lodash';
import {getBanRef} from '../src/helpers/firebaseHelper';
import {User} from '../src/db';

/**
 * Migrate "isBanned" property from Firebase to Mongodb
 */
export async function up() {
  const isBannedByTgUserId = {};

  const snapshot = await getBanRef().get();
  snapshot.forEach((child) => {
    isBannedByTgUserId[child.key] = child.val();
  });

  for (const tgUserId of _.keys(isBannedByTgUserId)) {
    const isBanned = isBannedByTgUserId[tgUserId];

    const existingUser = await User.findOne({tgUserId});
    if (existingUser && !!existingUser.isBanned === isBanned) {
      console.log(`SKIPPED: A user with "tgUserId" = ${tgUserId} has actual "isBanned" = ${isBanned} property`);
      continue;
    }

    console.log(`UPSERT: Upsert a new user with "tgUserId" = ${tgUserId} and "isBanned" = ${isBanned}`);
    await User.updateOne({tgUserId}, {isBanned}, {upsert: true});
  }
}
