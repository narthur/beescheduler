"use strict";
import { scheduleGoal } from "./scheduleGoal";
import { getStoredGoals } from "./services/baserow/getStoredGoals";
import { Callback, DbGoal, DbUser } from "../types";

function _setsched(username: string) {
  return getStoredGoals(username).then(
    (response: { user: DbUser; goals: DbGoal[] }) => {
      return Promise.all(
        response.goals.map((goal: DbGoal) => {
          return scheduleGoal(response.user.token, goal.slug, [
            parseFloat(goal["1"]),
            parseFloat(goal["2"]),
            parseFloat(goal["3"]),
            parseFloat(goal["4"]),
            parseFloat(goal["5"]),
            parseFloat(goal["6"]),
            parseFloat(goal["7"]),
          ]);
        })
      );
    }
  );
}

export const setsched = (username: unknown, context: unknown, cb: Callback) => {
  if (typeof username === "string") {
    console.log(`scheduling ${username}`);
    _setsched(username).then(
      (res: unknown) => cb(null, res),
      (err: unknown) => {
        // TODO:
        // FIXME: This should disable accounts with now-invalid
        // credentials.
        console.log(err);
        cb(err, null);
      }
    );
  } else {
    cb("setsched got a non-string parameter!", null);
  }
};
