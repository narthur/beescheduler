"use strict";
import DynamoBackup from "dynamo-backup-to-s3";
import { USERS_TABLE_NAME } from "../constants";
import { Callback } from "../types";

export const backupDDB = (evt: unknown, ctx: unknown, cb: Callback) => {
  console.log("Starting backup of " + USERS_TABLE_NAME);
  const backup = new DynamoBackup({
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
  backup.backupTable(USERS_TABLE_NAME, (err: string) => {
    if (err) {
      console.log("Backup error: " + err);
      cb(err, null);
    } else {
      console.log("Backup done!");
      cb(null, "");
    }
  });
};
