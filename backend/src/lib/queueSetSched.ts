"use strict";

import { setsched } from "./setsched";

// TODO: Consider using actual queue or deleting this wrapper
export const queueSetSched = (uname: unknown) => {
  console.log(`queueing scheduling for: ${uname}`);
  setsched(uname, {}, (err: unknown, res: unknown) => {
    if (err) {
      console.error(err);
    } else {
      console.log(res);
    }
  });
};
