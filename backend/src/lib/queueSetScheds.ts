"use strict";
import _ from "lodash/fp";
import { queueSetSched } from "./queueSetSched";
import { USERS_TABLE_NAME } from "../constants";
import { Callback } from "../types";
import { doc } from "serverless-dynamodb-client";

export const queueSetScheds = (evt: unknown, ctx: unknown, cb: Callback) => {
  doc
    .scan({
      TableName: USERS_TABLE_NAME,
      Select: "SPECIFIC_ATTRIBUTES",
      ProjectionExpression: "#n", // 'name' is a reserved word in DDB
      ExpressionAttributeNames: { "#n": "name" },
    })
    .promise()
    .then(
      (res: {
        LastEvaluatedKey?: unknown;
        Items?: Record<string, unknown>[];
      }) => {
        if (res.LastEvaluatedKey !== undefined) {
          cb(
            "Scan needed more than 1 page of results! Echo, go implement this.",
            null
          );
        } else {
          const promises = _.map(
            (item: { name: unknown }) => queueSetSched(item.name),
            res.Items
          );
          Promise.all(promises).then(
            (res) => cb(null, res),
            (err) => cb(err, null)
          );
        }
      },
      (err: unknown) => cb(err, null)
    );
};
