"use strict";
import { jsonResponse } from "./jsonResponse";
import { getStoredGoals } from "./getStoredGoals";
import { GOAL_ERROR_TYPES } from "../constants";
import { Callback, DbUser } from "../types";

export const getStoredGoalsHTTP = (
  event: {
    queryStringParameters: Record<string, string>;
  },
  context: unknown,
  cb: Callback
) => {
  if (
    !event.queryStringParameters ||
    !event.queryStringParameters.username ||
    !event.queryStringParameters.token
  ) {
    jsonResponse(cb, 400, {
      error: "missing username or token param",
    });
  } else {
    getStoredGoals(event.queryStringParameters.username).then(
      (result: { user: DbUser }) => {
        if (result.user.token === event.queryStringParameters.token) {
          jsonResponse(cb, 200, result);
        } else {
          jsonResponse(cb, 401, "Passed token doesn't match DDB");
        }
      },
      (fail: { type: string }) => {
        if (fail.type === GOAL_ERROR_TYPES.noSuchUser) {
          jsonResponse(cb, 404, {});
        } else {
          jsonResponse(cb, 500, fail);
        }
      }
    );
  }
};
