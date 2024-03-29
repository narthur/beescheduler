"use strict";
import * as bm from "./services/beeminder";
import { jsonResponse } from "./jsonResponse";
import { putUserInfo } from "./putUserInfo";
import { GOAL_ERROR_TYPES } from "../constants";
import { Callback, DbUser } from "../types";
import { getStoredGoals } from "./services/baserow/getStoredGoals";

// This is called every time the frontend is loaded, and therefore after every
// new authorization. It's responsible for updating the token in the DB if it's
// changed.

export const getGoalSlugs = (
  event: {
    queryStringParameters: Record<string, string>;
  },
  context: unknown,
  cb: Callback
) => {
  if (
    !event.queryStringParameters ||
    !event.queryStringParameters.access_token ||
    !event.queryStringParameters.username
  ) {
    jsonResponse(cb, 400, "missing access_token or username param");
  } else {
    const access_token = event.queryStringParameters.access_token;
    const username = event.queryStringParameters.username;
    const logMsg = (str: string) => console.log(username + ": " + str);
    bm.getUserInfo(access_token).then(
      (uinfo: { username: unknown; goals: unknown }) => {
        if (username === uinfo.username) {
          // If the username that Beeminder returns for the given token
          // matches the username in our query string...
          getStoredGoals(username).then(
            (result: { user: DbUser }) => {
              if (result.user.token === access_token) {
                // Token doesn't need updating.
                logMsg("existing user");
                jsonResponse(cb, 200, uinfo.goals);
              } else {
                // Token does need updating.
                result.user.token = access_token;
                putUserInfo({
                  name: username,
                  token: access_token,
                }).then(() => {
                  logMsg("update token");
                  jsonResponse(cb, 200, uinfo.goals);
                });
              }
            },
            (err: { type: string }) => {
              if (err.type === GOAL_ERROR_TYPES.noSuchUser) {
                putUserInfo({
                  token: access_token,
                  goals: {},
                  name: username,
                }).then(() => {
                  logMsg("new user");
                  jsonResponse(cb, 200, uinfo.goals);
                });
              } else {
                logMsg("DDB error fetching");
                console.log(JSON.stringify(err));
                jsonResponse(cb, 500, "DynamoDB error");
              }
            }
          );
        } else {
          jsonResponse(cb, 401, "passed username doesn't match token.");
        }
      },
      (err: { statusCode: number }) => {
        if (err.statusCode === 401) {
          jsonResponse(cb, 401, "Beeminder API returned 401");
        } else {
          console.log(err);
          jsonResponse(cb, 500, "");
        }
      }
    );
  }
};
