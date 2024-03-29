"use strict";
import { queueSetSched } from "./queueSetSched";
import { BASEROW_TABLE } from "../constants";
import { DbUser } from "../types";
import getBaserow from "./services/baserow/getBaserow";

export const queueSetScheds = async () => {
  const baserow = getBaserow();
  const { results: users } = await baserow.listRows<DbUser>(
    BASEROW_TABLE.users
  );
  const promises = users.map((user) => queueSetSched(user.username));

  await Promise.all(promises);
};
