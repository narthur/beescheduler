"use strict";
import { jsonResponse } from "./jsonResponse";
import { Callback } from "../types";

// For a bug report against Firefox...

export const jsonstring = (event: unknown, context: unknown, cb: Callback) =>
  jsonResponse(cb, 200, "hello");
