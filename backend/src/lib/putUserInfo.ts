"use strict";
import { BASEROW_TABLE } from "../constants";
import getBaserow from "./services/baserow/getBaserow";
import { getStoredGoals } from "./services/baserow/getStoredGoals";

export async function putUserInfo(uinfo: {
  name: string;
  token: string;
  goals?: Record<
    string,
    [number, number, number, number, number, number, number]
  >;
}): Promise<void> {
  // const validationResult = jsonschema.validate(uinfo, userDataSchema);
  // if (validationResult.valid) {
  //   return doc
  //     .put({
  //       TableName: USERS_TABLE_NAME,
  //       Item: uinfo,
  //     })
  //     .promise();
  // } else {
  //   return Promise.reject(validationResult.errors);
  // }
  const sdk = getBaserow();
  const { user, goals } = await getStoredGoals(uinfo.name);

  if (!user) {
    await sdk.addRow(BASEROW_TABLE.users, {
      username: uinfo.name,
      token: uinfo.token,
    });

    return putUserInfo(uinfo);
  }

  await sdk.updateRow(BASEROW_TABLE.users, user.id, {
    token: uinfo.token,
  });

  if (!uinfo.goals) return;

  for (const g of goals) {
    await sdk.deleteRow(BASEROW_TABLE.goals, g.id);
  }

  for (const [slug, sched] of Object.entries(uinfo.goals)) {
    await sdk.addRow(BASEROW_TABLE.goals, {
      slug,
      user: [user.id],
      "1": sched[0].toString(),
      "2": sched[1].toString(),
      "3": sched[2].toString(),
      "4": sched[3].toString(),
      "5": sched[4].toString(),
      "6": sched[5].toString(),
      "7": sched[6].toString(),
    });
  }
}
