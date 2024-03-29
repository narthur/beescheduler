"use strict";
import _ from "lodash/fp";
import jsonschema from "jsonschema";
import { GOAL_ERROR_TYPES } from "../constants";

export function goalError(
  type: string,
  msg: string | jsonschema.ValidationError[]
) {
  let ok = false;
  for (const ty of _.values(GOAL_ERROR_TYPES)) {
    if (type === ty) {
      ok = true;
      break;
    }
  }
  if (!ok) {
    throw "invalid goal error type!";
  } else {
    return {
      type: type,
      msg: msg,
    };
  }
}
