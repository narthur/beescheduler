import express, { NextFunction, Request, Response } from "express";
import { Callback } from "./types";
import { setGoalSchedule } from "./lib/setGoalSchedule";
import { getStoredGoalsHTTP } from "./lib/getStoredGoalsHTTP";
import { getGoalSlugs } from "./lib/getGoalSlugs";
import Cron from "croner";
import { queueSetScheds } from "./lib/queueSetScheds";

const app = express();

function cors(req: unknown, res: Response, next: NextFunction) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
}

app.use(cors);

function adapter(
  handler: (
    event: {
      body: string;
      queryStringParameters: Record<string, string>;
    },
    context: unknown,
    callback: Callback
  ) => void
) {
  return (req: Request, res: Response) => {
    handler(
      {
        body: req.body,
        queryStringParameters: req.params,
      },
      undefined,
      (err: unknown, response: unknown) => {
        if (err) {
          res.status(500).send(err);
          return;
        }
        res.send(response);
      }
    );
  };
}

app.get("/getGoalSlugs", adapter(getGoalSlugs));
app.get("/storedGoals", adapter(getStoredGoalsHTTP));
app.post("/storedGoals", adapter(setGoalSchedule));

app.listen(3001, () => {
  console.log("Server is running on port 3001");
});

const DAILY = "0 0 * * *";

new Cron(DAILY, queueSetScheds);
