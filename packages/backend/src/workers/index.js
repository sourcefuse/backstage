const scaffolder = require('./scaffold');
const microservice = require('./microservice');
const workerpool = require('workerpool');

workerpool.worker({
  scaffold: scaffolder,
  microservice: microservice,
});
