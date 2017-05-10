import jsonschema from 'jsonschema';
import _ from 'lodash';
import queryString from 'query-string';
import React from 'react';
import Button from 'react-bootstrap/lib/Button';
import Checkbox from 'react-bootstrap/lib/Checkbox';
import Col from 'react-bootstrap/lib/Col';
import Collapse from 'react-bootstrap/lib/Collapse';
import Grid from 'react-bootstrap/lib/Grid';
import Row from 'react-bootstrap/lib/Row';
import Table from 'react-bootstrap/lib/Table';
import Well from 'react-bootstrap/lib/Well';

import './App.css';
import userDataSchema from './userDataSchema.js';
import {
  deepSetState
} from './util.js';
import ValidatedFormControl from './ValidatedFormControl.js';

function getSLSBaseURL() {
  if (process.env.REACT_APP_LOCAL_SLS) {
    return "https://localhost:4000";
  } else {
    if (process.env.REACT_APP_SLS_BASEURL !== undefined) {
      return process.env.REACT_APP_SLS_BASEURL;
    } else {
      alert("SLS base url not set!");
    }
  }
}

class App extends React.Component {
  componentWillMount() {
    let foundUsername = null;
    let foundToken = null;

    const qvars = queryString.parse(location.search);
    const storedUsername = localStorage.getItem('username');
    const storedToken = localStorage.getItem('token');
    if (qvars.access_token && qvars.username) {
      foundUsername = qvars.username;
      foundToken = qvars.access_token;
      localStorage.setItem('username', foundUsername);
      localStorage.setItem('token', foundToken);
    } else if (storedUsername !== null && storedToken !== null) {
      foundUsername = storedUsername;
      foundToken = storedToken;
    }
    this.state = {
      username: foundUsername,
      token: foundToken,
      authFailed: false
    };
  }

  logout = () => {
    localStorage.clear();
    this.setState({
      username: null,
      token: null
    });
  };

  client_id() {
    if (document.location.href.match(/localhost/) !== null) {
      return "dqlmuqav6goh1cy9bdmpyu6wz";
    } else if (document.location.href.match(/beescheduler-dev.echonolan.net/) !== null) {
      return "atfphg2m06sjkavmodmwxxlfp";
    } else if (document.location.href.match(/beescheduler.echonolan.net/)) {
      alert("Make a BM app for prod, Echo!");
    } else {
      alert("Couldn't figure out which client ID to use, aborting");
    }
  }

  onAuthFail = () => this.setState({
    authFailed: true
  });

  render() {
    let header = {};
    let body = {};
    if (!this.state.username || this.state.authFailed) {
      const authParams = {
        client_id: this.client_id(),
        redirect_uri: document.location,
        response_type: "token"
      };
      const authUrl = "https://www.beeminder.com/apps/authorize?" + queryString.stringify(authParams);
      header = <Row><Col md={12}><a href={authUrl}>{this.state.authFailed ? "Authorization failed, try again" : "Authorize"}</a></Col></Row>;
      body = "";
    } else {
      header = [<Col md={12}>{"Sup, " + this.state.username + "?"}</Col>,
        <Col md={12}><Button onClick={this.logout}>Log out</Button></Col>,
        <Col md={12}><HelpBox/></Col>
      ].map((val, idx) => <Row key={idx}>{val}</Row>);
      body = (<GoalsTable
        username={this.state.username}
        token={this.state.token}
        onAuthFail={this.onAuthFail}/>);
    }
    return (
      <Grid>
          {header}
          <Row><Col md={12} style={{height: "15px"}}/></Row>
          {body}
      </Grid>
    )
  }
}

class GoalsTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = ({
      goals: {},
      dirty: false,
      saving: false
    });

    this.setupTable();
  }

  async setupTable() {
    await this.getGoalSlugs();
    await this.getStoredGoals();
  }

  async getGoalSlugs() {
    const queryParams = {
      "access_token": this.props.token
    }
    let resp = await
    fetch(getSLSBaseURL() + "/getGoalSlugs?" +
      queryString.stringify(queryParams));
    if (resp.ok) {
      const respArray = await resp.json();
      for (let slug of respArray) {
        deepSetState(this, {
          goals: {
            [slug]: {
              schedule: "fetching",
              validInput: true
            }
          }
        });
      }
    } else if (resp.status === 401) {
      this.props.onAuthFail();
    }
  }

  async getStoredGoals() {
    const qstring = queryString.stringify({
      username: this.props.username,
      token: this.props.token
    });
    let resp = await fetch(getSLSBaseURL() + "/storedGoals?" + qstring);
    // There should be error handling here.
    const respObj = await resp.json();
    const validationResult = jsonschema.validate(respObj, userDataSchema);
    if (!validationResult.valid) {
      alert("Server sent invalid data. This should never happen. Try refreshing?");
    } else {
      _.forEach(respObj.goals, (schedule, goalSlug) => {
        if (this.state.goals[goalSlug] === undefined) {
          // Cleaning up goals that exist in DynamoDB but not on Beeminder is
          // the backend's responsibility.
          return;
        } else {
          deepSetState(this, {
            goals: {
              [goalSlug]: {
                schedule: schedule
              }
            }
          });
        }
      });
      _.forEach(this.state.goals, (goal, goalSlug) => {
        if (goal.schedule === "fetching") {
          deepSetState(this, {
            goals: {
              [goalSlug]: {
                schedule: "unscheduled"
              }
            }
          });
        }
      });
    }
  }

  // When one of the "using Beescheduler" checkboxes changes.
  onCheckboxChange = _.curry((gname, evt) => {
    this.setState({
      dirty: true
    });

    const schedule = this.state.goals[gname].schedule;
    if (Array.isArray(schedule)) {
      deepSetState(this, {
        goals: {
          [gname]: {
            schedule: "unscheduled"
          }
        }
      });
    } else if (schedule === "unscheduled") {
      deepSetState(this, {
        goals: {
          [gname]: {
            schedule: Array(7).fill(0)
          }
        }
      });
    } // If it's not fetched yet, do nothing.
  });

  // When one of the day rate inputs changes.
  onDayChange = _.curry((gname, day, evt) => {
    const newVal = Number(evt.target.value);
    this.setState(prevState => {
      let newSchedule = _.clone(prevState.goals[gname].schedule);
      newSchedule[day] = newVal;
      return _.merge({}, prevState, {
        goals: {
          [gname]: {
            schedule: newSchedule
          }
        }
      });
    });
    this.setState({
      dirty: true
    });
  });

  // When one of rate fields changes validation state.
  onValidationStateChange = _.curry((gname, valid) => {
    deepSetState(this, {
      goals: {
        [gname]: {
          validInput: valid
        }
      }
    });
  })

  allValid = () => _.every(this.state.goals, g => g.validInput)

  saveSchedule() {
    this.setState(prevState => {
      const scheduledGoals = filterObjectVals(prevState.goals, g => Array.isArray(g.schedule));
      const toStore = {
        token: this.props.token,
        name: this.props.username,
        goals: _.mapValues(scheduledGoals, g => g.schedule)
      };
      const validationResult = jsonschema.validate(toStore, userDataSchema);
      if (validationResult.valid) {
        fetch(
            getSLSBaseURL() + "/storedGoals", {
              method: "POST",
              body: JSON.stringify(toStore)
            })
          .then(
            resp => {
              if (resp.ok) {
                this.setState({
                  saving: false
                });
              } else {
                //FIXME
                alert("saving failed", resp);
              }
            },
            err => alert("saving failed", err))
      }
      let newState = _.clone(prevState);
      newState.saving = true;
      newState.dirty = false;
      return newState;
    });
  }

  render() {
    const sortedGoals = _.sortBy(_.toPairs(this.state.goals), g => g[0]);
    const scheduledGoals = _.filter(sortedGoals, g => Array.isArray(g[1]));
    const unscheduledGoals = _.filter(sortedGoals, g => !Array.isArray(g[1]));
    const rowify = (x =>
      <GoalRow
          onCheckboxChange={this.onCheckboxChange(x[0])}
          onDayChange={this.onDayChange(x[0])}
          onValidationStateChange={this.onValidationStateChange(x[0])}
          key={x[0]}
          slug={x[0]}
          schedule={x[1].schedule}
          disabled={this.state.saving}/>);

    return (
      <div>
          <Button
              bsStyle="primary"
              disabled={!(this.state.dirty) || !(this.allValid()) || this.state.saving}
              onClick={this.saveSchedule.bind(this)}>
              {this.state.saving ? "Saving..." : "Save changes"}
          </Button>
          <Table style={{tableLayout: "fixed"}}>
              <thead>
                  <tr>
                      {["Goal name",
                        "Using Beescheduler",
                        "Sunday",
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday"].map((str, idx) =>
                          <th key={idx} style={{width: idx < 2 ? "17.5%": "14%"}} scope='col'>{str}</th>)}
                  </tr>
              </thead>
              <tbody>
                  {scheduledGoals.map(rowify)}
                  {unscheduledGoals.map(rowify)}
              </tbody>
          </Table>
      </div>
    );
  }
}

class GoalRow extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      validRates: Array(7).fill(true)
    };
  }

  render() {
    let days;

    if (this.props.schedule === "fetching") {
      days = Array(7).fill("?");
    } else if (this.props.schedule === "unscheduled") {
      days = Array(7).fill("N/A");
    } else {
      days = this.props.schedule.map((val, idx) =>
        <ValidatedFormControl
            size={4}
            style={{width: "auto"}}
            initVal={val.toString()}
            onChange={this.props.onDayChange(idx)}
            validate={val => !isNaN(Number(val)) && val !== ""}
            onValidationStateChange={this.onValidationStateChange(idx)}
            disabled={this.props.disabled}/>);
    }

    let daysEls = days.map((str, idx) => <td key={idx}>{str}</td>);
    return (
      <tr>
        <th scope='row'>
            {this.props.slug}
        </th>
        <td>
            <Checkbox
                checked={Array.isArray(this.props.schedule)}
                onChange={this.props.onCheckboxChange}
                disabled={this.props.disabled}/>
        </td>
        {daysEls}
    </tr>
    );
  }

  onValidationStateChange = _.curry((idx, valid) => {
    const numValidRates = _.filter(this.state.validRates).length;
    const wasValid = numValidRates === 7;
    const isValid = (numValidRates + (valid ? 1 : -1)) === 7;

    this.setState(prevState => {
      let newValidRates = _.clone(prevState.validRates);
      newValidRates[idx] = valid;
      return {
        validRates: newValidRates
      };
    });

    if (wasValid !== isValid) {
      this.props.onValidationStateChange(isValid);
    }
  })
}

export default App;

function filterObjectVals(obj, f) {
  let res = {}
  _.forOwn(obj, (val, key) => {
    if (f(val)) {
      res[key] = val;
    }
  })
  return res;
}

class HelpBox extends React.Component {
  constructor(props) {
    super(props);
    try {
      let wantsHelp = JSON.parse(localStorage.getItem("wantsHelp"));
      if (typeof wantsHelp === "boolean") {
        this.state = {
          wantsHelp: wantsHelp
        };
      } else {
        localStorage.setItem("wantsHelp", JSON.stringify(true));
        this.state = {
          wantsHelp: true
        };
      }
    } catch (ex) {
      if (ex instanceof SyntaxError) {
        console.log("parsing wantsHelp: ", ex);
        localStorage.setItem("wantsHelp", true);
        this.state = {
          wantsHelp: true
        };
      }
    }
  }

  toggleWantHelp = () => {
    localStorage.setItem("wantsHelp", JSON.stringify(!this.state.wantsHelp));
    this.setState({
      wantsHelp: !this.state.wantsHelp
    });
  }
  render() {
    return (
      <div>
          <Button onClick={this.toggleWantHelp}>
              {this.state.wantsHelp ? "Hide help" : "Show help"}
          </Button>
          <Collapse in={this.state.wantsHelp}>
              <div><Well>
                  <p>
                      Beescheduler lets you schedule different rates for your
                      Beeminder goals based on the days of the week. For example,
                      you could write 500 words on Monday, Tuesday and Wednesday and
                      take the rest of the week off. Or go for short runs every weekday
                      and longer ones on the weekends. Or whatever else you can think of.
                  </p>
                  <p>
                      The table below shows your current Beeminder goals. To use
                      Beescheduler for one of them, click on the checkbox under
                      "Using Beescheduler" and fill in rates for each day of the week.
                  </p>
              </Well></div>
          </Collapse>
      </div>
    );
  }
}
