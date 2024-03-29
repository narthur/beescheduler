"use strict";
import jsonschema from "jsonschema";
import userDataSchema from "../../userDataSchema";
import { USERS_TABLE_NAME } from "../constants";
import { doc } from "serverless-dynamodb-client";

export function putUserInfo(uinfo: Record<string, unknown>) {
  const validationResult = jsonschema.validate(uinfo, userDataSchema);
  if (validationResult.valid) {
    return doc
      .put({
        TableName: USERS_TABLE_NAME,
        Item: uinfo,
      })
      .promise();
  } else {
    return Promise.reject(validationResult.errors);
  }
}
