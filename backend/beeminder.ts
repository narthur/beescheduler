"use strict";

import _ from "lodash/fp";
import rqpr from "request-promise-native";

export type RoadTime = number | string;
export type RoadGoal = number;
export type RoadRate = number;
export type SparseSegment = [RoadTime | null, RoadGoal | null, RoadRate | null];
export type DenseSegment = [RoadTime, RoadGoal, RoadRate];
export type Roadall = SparseSegment[];
export type Fullroad = DenseSegment[];

export const beeDateFormat = (date: {
  format: (arg0: string, arg1: unknown) => string;
}): string => {
  return date.format("YYYY-MM-DD", date);
};

export const setRoad = (goalName: string, roadAll: Roadall, token: unknown) => {
  console.log("setting " + goalName);
  console.log(roadAll);
  const opts = {
    uri:
      "https://www.beeminder.com/api/v1/users/me/goals/" + goalName + ".json",
    method: "PUT",
    json: true,
    body: {
      access_token: token,
      roadall: normalizeRoad(roadAll),
    },
  };
  if (roadAll.length === 0) {
    return Promise.reject("empty road");
  } else {
    for (let i = 1; i < roadAll.length; i++) {
      if (_.isEqual(roadAll[i], roadAll[i - 1])) {
        return Promise.reject(`duplicate row: ${roadAll[i].toString()}`);
      }
    }
    return rqpr(opts);
  }
};

function normalizeRoad(roadAll: Roadall) {
  // Walk down the road, coalescing consecutive segments with the same rate.
  // Hopefully this will make it less error prone?

  const isTimeAndRate = (segment: SparseSegment) =>
    segment[0] !== null && segment[2] !== null;

  // The first row is an initial date and value, it's always preserved.
  const out = [_.clone(roadAll[0])];

  for (let i = 1; i < roadAll.length; i++) {
    if (isTimeAndRate(roadAll[i]) && isTimeAndRate(out[out.length - 1])) {
      if (roadAll[i][2] === out[out.length - 1][2]) {
        console.log("extending segment: ", out[out.length - 1]);
        out[out.length - 1][0] = roadAll[i][0];
      } else {
        console.log("adding segment (1): ", roadAll[i]);
        out.push(_.clone(roadAll[i]));
      }
    } else {
      console.log("adding segment (2): ", roadAll[i]);
      out.push(_.clone(roadAll[i]));
    }
  }

  console.log("Normalized road:");
  console.log(out);
  return out;
}

export const getGoal = (token: unknown, goalName: string) => {
  return rqpr({
    uri:
      "https://www.beeminder.com/api/v1/users/me/goals/" + goalName + ".json",
    qs: { access_token: token },
    json: true,
  });
};

export const getUserInfo = (token: string) => {
  if (process.env.IS_OFFLINE && token === "fakeToken") {
    return Promise.resolve({
      goals: [
        "profitable",
        "jobhunt",
        "bedroom",
        "survey",
        "cycling",
        "moonshot",
        "weeklyreview",
        "reading",
      ],
      username: "RonaldPUserman",
    });
  } else {
    return rqpr({
      uri: "https://www.beeminder.com/api/v1/users/me.json",
      qs: {
        access_token: token,
      },
      json: true,
    });
  }
};

export const getRUnitMultiplier = (goalInfo: { runits: unknown }): number => {
  switch (goalInfo.runits) {
    case "y":
      return 365.25;
    case "m":
      return 30;
    case "w":
      return 7;
    case "d":
      return 1;
    case "h":
      return 1 / 24;
    default:
      throw new Error(`unknown runit: ${goalInfo.runits}`);
  }
};
