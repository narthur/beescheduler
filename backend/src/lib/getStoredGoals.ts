"use strict";
import { BASEROW_TABLE } from "../constants";
import getBaserow from "./getBaserow";
import { DbGoal, DbUser } from "../types";

// Pull a user's goals out of the DB and validate it.
export async function getStoredGoals(username: string): Promise<{
  user: DbUser;
  goals: DbGoal[];
}> {
  // return doc
  //   .get({
  //     TableName: USERS_TABLE_NAME,
  //     Key: {
  //       name: username,
  //     },
  //   })
  //   .promise()
  //   .then((res: { Item?: Record<string, unknown> }) => {
  //     if (_.isEqual(res, {})) {
  //       return Promise.reject(goalError(GOAL_ERROR_TYPES.noSuchUser, ""));
  //     } else {
  //       const validationResult = jsonschema.validate(res.Item, userDataSchema);
  //       if (validationResult.valid) {
  //         return Promise.resolve(res.Item);
  //       } else {
  //         return Promise.reject(
  //           goalError(GOAL_ERROR_TYPES.badDb, validationResult.errors)
  //         );
  //       }
  //     }
  //   });

  const sdk = getBaserow();
  const { results: users } = await sdk.listRows<DbUser>(BASEROW_TABLE.users, {
    filters: {
      filter_type: "AND",
      filters: [
        {
          type: "equal",
          field: "username",
          value: username,
        },
      ],
      groups: [],
    },
  });

  if (users.length !== 1) {
    throw new Error(`User not found. Number of matches: ${users.length}`);
  }

  const user = users[0];

  const { results: goals } = await sdk.listRows<DbGoal>(BASEROW_TABLE.goals, {
    filters: {
      filter_type: "AND",
      filters: [
        {
          type: "link_row_has",
          field: "user",
          value: user.id.toString(),
        },
      ],
      groups: [],
    },
  });

  return {
    user,
    goals,
  };
}
