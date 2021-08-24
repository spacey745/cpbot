import {getUsersRef} from '../src/helpers/firebaseHelper';
import {User} from '../src/db';

/**
 * Copy "users" data from Firebase to Mongodb
 */
export async function up() {
  const dbUsers = [];

  const snapshot = await getUsersRef().get();
  snapshot.forEach((child) => {
    const fbUser = child.val();
    dbUsers.push({
      tgUserId: Number.parseInt(fbUser.id),
      firstUsername: fbUser.firstUsername || fbUser.username,
      username: fbUser.username,
      initFirstName: fbUser.initFirstName || fbUser.firstName,
      firstName: fbUser.firstName,
      initLastName: fbUser.initLastName || fbUser.lastName,
      lastName: fbUser.lastName,
      langCode: fbUser.langCode,
      isFavorite: fbUser.isFavorite,
      maskUid: fbUser.maskUid,
      created: fbUser.created,
      lastUsed: fbUser.lastUsed || fbUser.created,
    });
  });

  for (const dbUser of dbUsers) {
    const existingUser = await User.findOne({tgUserId: dbUser.tgUserId});
    if (existingUser) {
      console.log(`SKIPPED: A user with "tgUserId" = ${dbUser.tgUserId} already exists`);
      continue;
    }

    console.log(`ADD: Create a new user with "tgUserId" = ${dbUser.tgUserId}`);
    await User.create(dbUser);
  }
}
