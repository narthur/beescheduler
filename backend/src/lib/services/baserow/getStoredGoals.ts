"use strict";
import { BASEROW_TABLE } from "../../../constants";
import getBaserow from "./getBaserow";
import { DbGoal, DbUser } from "../../../types";
import { getUser } from "./getUser";

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
  const user = await getUser(username);

  if (!user) {
    throw new Error("No such user");
  }

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
