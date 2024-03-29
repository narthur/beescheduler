"use strict";
import { BASEROW_TABLE } from "../../../constants";
import getBaserow from "./getBaserow";
import { DbUser } from "../../../types";

export async function getUser(username: string): Promise<DbUser | undefined> {
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

  return users[0];
}
