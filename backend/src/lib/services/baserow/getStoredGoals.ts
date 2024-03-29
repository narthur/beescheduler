"use strict";
import { BASEROW_TABLE } from "../../../constants";
import getBaserow from "./getBaserow";
import { DbGoal, DbUser } from "../../../types";
import { getUser } from "./getUser";

// Pull a user's goals out of the DB and validate it.
export async function getStoredGoals(username: string): Promise<{
  user?: DbUser;
  goals: DbGoal[];
}> {
  const sdk = getBaserow();
  const user = await getUser(username);

  if (!user) {
    return {
      user: undefined,
      goals: [],
    };
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
