"use strict";

export const USERS_TABLE_NAME = `users-${process.env.SLS_STAGE}`;

export const GOAL_ERROR_TYPES = {
  badDb: "invalid item in db",
  noSuchUser: "no such user",
};
