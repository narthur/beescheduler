"use strict";
import _ from "lodash/fp";
import jsonschema from "jsonschema";
import userDataSchema from "../../userDataSchema";
import { goalError } from "./goalError";
import { USERS_TABLE_NAME, GOAL_ERROR_TYPES } from "../constants";
import { doc } from "serverless-dynamodb-client";

// Pull a user's goals out of the DB and validate it.

export function getStoredGoals(username: string) {
  return doc
    .get({
      TableName: USERS_TABLE_NAME,
      Key: {
        name: username,
      },
    })
    .promise()
    .then((res: { Item?: Record<string, unknown> }) => {
      if (_.isEqual(res, {})) {
        return Promise.reject(goalError(GOAL_ERROR_TYPES.noSuchUser, ""));
      } else {
        const validationResult = jsonschema.validate(res.Item, userDataSchema);
        if (validationResult.valid) {
          return Promise.resolve(res.Item);
        } else {
          return Promise.reject(
            goalError(GOAL_ERROR_TYPES.badDb, validationResult.errors)
          );
        }
      }
    });
}
