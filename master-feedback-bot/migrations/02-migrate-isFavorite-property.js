import _ from 'lodash';
import {getFavRef} from '../src/helpers/firebaseHelper';
import {User} from '../src/db';

/**
 * Migrate "isFavorite" property from Firebase to Mongodb
 */
export async function up() {
  const isFavoriteByTgUserId = {};

  const snapshot = await getFavRef().get();
  snapshot.forEach((child) => {
    isFavoriteByTgUserId[child.key] = child.val();
  });

  for (const tgUserId of _.keys(isFavoriteByTgUserId)) {
    const isFavorite = isFavoriteByTgUserId[tgUserId];

    const existingUser = await User.findOne({tgUserId});
    if (existingUser && !!existingUser.isFavorite === isFavorite) {
      console.log(`SKIPPED: A user with "tgUserId" = ${tgUserId} has actual "isFavorite" = ${isFavorite} property`);
      continue;
    }

    console.log(`UPSERT: Upsert a new user with "tgUserId" = ${tgUserId} and "isFavorite" = ${isFavorite}`);
    await User.updateOne({tgUserId}, {isFavorite}, {upsert: true});
  }
}
