"use strict";

export type Callback = (err: unknown, res: unknown) => void;

export type DbUser = {
  id: number;
  order: string; // "1.00000000000000000000"
  username: string;
  token: string;
  goals: Array<{ id: number; value: string }>;
};

export type DbGoal = {
  id: number;
  order: string; // "1.00000000000000000000"
  slug: string;
  user: Array<{ id: number; value: string }>;
  "1": string; // "0.0000000000"
  "2": string; // "0.0000000000"
  "3": string; // "0.0000000000"
  "4": string; // "0.0000000000"
  "5": string; // "0.0000000000"
  "6": string; // "0.0000000000"
  "7": string; // "0.0000000000"
};
