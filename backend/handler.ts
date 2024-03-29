"use strict";

import moment, { Moment } from "moment";
import _ from "lodash/fp";
import dynamodb from "serverless-dynamodb-client";
import jsonschema from "jsonschema";
import aws from "aws-sdk";
import dynamoBackup from "dynamo-backup-to-s3";
import * as bm from "./beeminder";
import userDataSchema from "./userDataSchema";

export type Callback = (err: unknown, res: unknown) => void;

const dynamoDoc = dynamodb.doc;
const lambda = new aws.Lambda();
const usersTableName = `users-${process.env.SLS_STAGE}`;

function scheduleGoal(token: unknown, goalName: string, schedule: number[]) {
  console.log(`scheduleGoal ${goalName} ${schedule}`);
  const oneWeekOut = moment()
    .utcOffset(-4)
    .set({
      hour: 12,
      minute: 0,
      second: 0,
      millisecond: 0,
    })
    .add(7, "days");
  return bm
    .getGoal(token, goalName)
    .then(
      (goalInfo: {
        frozen: unknown;
        roadall: bm.Roadall;
        fullroad: bm.Fullroad;
        runits: unknown;
      }) => {
        // The idea here is to keep the road exactly the same up until the
        // akrasia horizon, then schedule by days of the week from akrasia
        // horizon to akrasia horizon + 7 days. To that end, we remove all
        // segments before a week from today, add a new segment that continues
        // the last rate up until the akrasia horizon, then add all our stuff
        // after that.
        console.log(goalInfo);
        if (goalInfo.frozen) {
          return Promise.reject(
            "goal is frozen, editing road may cause spurious derail."
          );
        }
        const rUnitMultiplier = bm.getRUnitMultiplier(goalInfo);
        const truncatedRoad: bm.Roadall = goalInfo.roadall
          .map((x): [Moment, number | null, number | null] => [
            moment(x[0], "X"),
            x[1],
            x[2],
          ])
          .filter((x) => x[0] < oneWeekOut)
          .map((x) => [bm.beeDateFormat(x[0]), x[1], x[2]]);
        // Add the segment that continues at the same rate up until the akrasia
        // horizon.
        if (truncatedRoad.length < goalInfo.roadall.length) {
          const lastSegmentFull = goalInfo.fullroad[truncatedRoad.length];
          truncatedRoad.push([
            bm.beeDateFormat(oneWeekOut),
            null,
            lastSegmentFull[2],
          ]);
        } else {
          // If the goal ends before one week from today, the rate is zero
          // after the end.
          truncatedRoad.push([bm.beeDateFormat(oneWeekOut), null, 0]);
        }
        const oneWeekOutDay = oneWeekOut.day();
        const newSegment: bm.Roadall = [];
        for (let i = 0; i < 7; i++) {
          const targetDate = oneWeekOut.clone();
          if (oneWeekOutDay < i) {
            targetDate.add(i - oneWeekOutDay, "d");
          } else {
            targetDate.add(i - oneWeekOutDay + 7, "d");
          }
          newSegment.push([
            bm.beeDateFormat(targetDate),
            null,
            rUnitMultiplier * schedule[i],
          ]);
        }
        newSegment.sort(); // this is done by comparing on string representations.
        console.log("New segment:");
        console.log(newSegment);
        const newRoadall: bm.Roadall = truncatedRoad.concat(newSegment);
        return bm.setRoad(goalName, newRoadall, token);
      }
    );
}

function jsonResponse(cb: Callback, status: number, data: unknown) {
  cb(null, {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(data),
  });
}

function putUserInfo(uinfo: unknown) {
  const validationResult = jsonschema.validate(uinfo, userDataSchema);
  if (validationResult.valid) {
    return dynamoDoc
      .put({
        TableName: usersTableName,
        Item: uinfo,
      })
      .promise();
  } else {
    return Promise.reject(validationResult.errors);
  }
}

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
            (ddbItem: { token: string }) => {
              if (ddbItem.token === access_token) {
                // Token doesn't need updating.
                logMsg("existing user");
                jsonResponse(cb, 200, uinfo.goals);
              } else {
                // Token does need updating.
                ddbItem.token = access_token;
                putUserInfo(ddbItem).then(() => {
                  logMsg("update token");
                  jsonResponse(cb, 200, uinfo.goals);
                });
              }
            },
            (err: { type: string }) => {
              if (err.type === goalErrorTypes.noSuchUser) {
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

const goalErrorTypes = {
  badDb: "invalid item in db",
  noSuchUser: "no such user",
};

function goalError(type: string, msg: string | jsonschema.ValidationError[]) {
  let ok = false;
  for (const ty of _.values(goalErrorTypes)) {
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

// Pull a user's goals out of the DB and validate it.
function getStoredGoals(username: string) {
  return dynamoDoc
    .get({
      TableName: usersTableName,
      Key: {
        name: username,
      },
    })
    .promise()
    .then((res: { Item: unknown }) => {
      if (_.isEqual(res, {})) {
        return Promise.reject(goalError(goalErrorTypes.noSuchUser, ""));
      } else {
        const validationResult = jsonschema.validate(res.Item, userDataSchema);
        if (validationResult.valid) {
          return Promise.resolve(res.Item);
        } else {
          return Promise.reject(
            goalError(goalErrorTypes.badDb, validationResult.errors)
          );
        }
      }
    });
}

export const getStoredGoalsHTTP = (
  event: {
    queryStringParameters: Record<string, string>;
  },
  context: unknown,
  cb: Callback
) => {
  if (
    !event.queryStringParameters ||
    !event.queryStringParameters.username ||
    !event.queryStringParameters.token
  ) {
    jsonResponse(cb, 400, {
      error: "missing username or token param",
    });
  } else {
    getStoredGoals(event.queryStringParameters.username).then(
      (val: { token: unknown }) => {
        if (val.token === event.queryStringParameters.token) {
          jsonResponse(cb, 200, val);
        } else {
          jsonResponse(cb, 401, "Passed token doesn't match DDB");
        }
      },
      (fail: { type: string }) => {
        if (fail.type === goalErrorTypes.noSuchUser) {
          jsonResponse(cb, 404, {});
        } else {
          jsonResponse(cb, 500, fail);
        }
      }
    );
  }
};

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
        (record: { token: unknown }) => record.token === bodyParsed.token,
        () => false
      );

    if (validationResult.valid) {
      // If the token sent matches our database, we can assume it's good.
      tokenValidatedInDDB().then((validated: unknown) => {
        if (validated) {
          queueSetSched(bodyParsed.name).then(() => putUserInfoAndExit());
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

// For a bug report against Firefox...

export const jsonstring = (event: unknown, context: unknown, cb: Callback) =>
  jsonResponse(cb, 200, "hello");

function _setsched(username: string) {
  return getStoredGoals(username).then(
    (res: { token: unknown; goals: Record<string, unknown> }) => {
      return Promise.all(
        _.map(
          (ent: [string, number[]]) => scheduleGoal(res.token, ent[0], ent[1]),
          _.toPairs(res.goals)
        )
      );
    }
  );
}

export const setsched = (username: unknown, context: unknown, cb: Callback) => {
  if (typeof username === "string") {
    console.log(`scheduling ${username}`);
    _setsched(username).then(
      (res: unknown) => cb(null, res),
      (err: unknown) => {
        // FIXME: This should disable accounts with now-invalid
        // credentials.
        console.log(err);
        cb(err, null);
      }
    );
  } else {
    cb("setsched got a non-string parameter!", null);
  }
};

const queueSetSched = (uname: unknown) => {
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

export const queueSetScheds = (evt: unknown, ctx: unknown, cb: Callback) => {
  dynamoDoc
    .scan({
      TableName: usersTableName,
      Select: "SPECIFIC_ATTRIBUTES",
      ProjectionExpression: "#n", // 'name' is a reserved word in DDB
      ExpressionAttributeNames: { "#n": "name" },
    })
    .promise()
    .then(
      (res: { LastEvaluatedKey: undefined; Items: { name: unknown }[] }) => {
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

export const backupDDB = (evt: unknown, ctx: unknown, cb: Callback) => {
  console.log("Starting backup of " + usersTableName);
  const backup = new dynamoBackup({
    bucket: "beescheduler-" + process.env.SLS_STAGE + "-ddb-backup",
    stopOnFailure: true,
    base64Binay: true,
  });
  backup.on("error", (data: unknown) => {
    console.log("Error backing up!");
    console.log(JSON.stringify(data));
  });
  backup.on("end-backup", (tableName: string, backupDuration: number) => {
    console.log("Done backing up " + tableName);
    console.log("Backup took " + backupDuration.valueOf() / 1000 + " seconds.");
  });
  backup.backupTable(usersTableName, (err: string) => {
    if (err) {
      console.log("Backup error: " + err);
      cb(err, null);
    } else {
      console.log("Backup done!");
      cb(null, "");
    }
  });
};
