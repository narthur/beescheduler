"use strict";
import moment, { Moment } from "moment";
import * as bm from "./beeminder";

export function scheduleGoal(
  token: unknown,
  goalName: string,
  schedule: number[]
) {
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
