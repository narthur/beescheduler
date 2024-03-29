"use strict";
import { Callback } from "../types";

export function jsonResponse(cb: Callback, status: number, data: unknown) {
  cb(null, {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(data),
  });
}
