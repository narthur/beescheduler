"use strict";
import _ from "lodash/fp";
import { scheduleGoal } from "./scheduleGoal";
import { getStoredGoals } from "./getStoredGoals";
import { Callback } from "../types";

function _setsched(username: string) {
  return getStoredGoals(username).then(
    (res: { token: unknown; goals: Record<string, unknown> }) => {
      return Promise.all(
        _.map(
          (ent: [string, number[]]) => scheduleGoal(res.token, ent[0], ent[1]),
          _.toPairs(res.goals)
        )
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
