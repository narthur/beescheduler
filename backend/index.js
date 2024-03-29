import express from "express";
import {
  getGoalSlugs,
  getStoredGoalsHTTP,
  setGoalSchedule,
  jsonstring,
} from "./handler";

const app = express();

app.get("/getGoalSlugs", (req, res) => {
  getGoalSlugs(req, res).then((result) => {
    res.send(result);
  });
});

app.get("/storedGoals", (req, res) => {
  getStoredGoalsHTTP(req, res).then((result) => {
    res.send(result);
  });
});

app.post("/storedGoals", (req, res) => {
  setGoalSchedule(req, res).then((result) => {
    res.send(result);
  });
});

app.get("/jsonstring", (req, res) => {
  jsonstring(req, res).then((result) => {
    res.send(result);
  });
});

app.listen(3001, () => {
  console.log("Server is running on port 3001");
});
