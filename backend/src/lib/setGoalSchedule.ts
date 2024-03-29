"use strict";
import jsonschema from "jsonschema";
import userDataSchema from "../../userDataSchema";
import { jsonResponse } from "./jsonResponse";
import { putUserInfo } from "./putUserInfo";
import { getStoredGoals } from "./services/baserow/getStoredGoals";
import { Callback, DbUser } from "../types";
import { queueSetSched } from "./queueSetSched";

export const setGoalSchedule = (
  event: { body: string },
  context: unknown,
  cb: Callback
) => {
  try {
    const bodyParsed = JSON.parse(event.body);
    const validationResult = jsonschema.validate(bodyParsed, userDataSchema);
    const putUserInfoAndExit = () =>
      putUserInfo(bodyParsed).then(
        () => jsonResponse(cb, 200, "ok"),
        (err: unknown) => jsonResponse(cb, 500, err)
      );

    const tokenValidatedInDDB = () =>
      getStoredGoals(bodyParsed.name).then(
        (result: { user?: DbUser }) => result.user?.token === bodyParsed.token,
        () => false
      );

    if (validationResult.valid) {
      // If the token sent matches our database, we can assume it's good.
      tokenValidatedInDDB().then((validated: unknown) => {
        if (validated) {
          queueSetSched(bodyParsed.name);
          putUserInfoAndExit();
        } else {
          jsonResponse(cb, 401, "token doesn't match database");
        }
      });
    } else {
      jsonResponse(cb, 400, validationResult.errors);
    }
  } catch (ex) {
    if (ex instanceof SyntaxError) {
      jsonResponse(cb, 400, `post body not valid JSON: ${ex.message}`);
    } else {
      throw ex;
    }
  }
};
