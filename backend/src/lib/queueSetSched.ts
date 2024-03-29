"use strict";

import aws from "aws-sdk";

const lambda = new aws.Lambda();

export const queueSetSched = (uname: unknown) => {
  console.log("queueing scheduling for: " + uname);
  if (process.env.IS_OFFLINE) {
    console.log("offline environment, not queueing async scheduling");
    return Promise.resolve("offline");
  } else {
    return lambda
      .invoke({
        FunctionName: `beescheduler-${process.env.SLS_STAGE}-setsched`,
        InvocationType: "Event",
        Payload: JSON.stringify(uname),
      })
      .promise();
  }
};
