const scaffold = require('./scaffold');
const microservice = require('./microservice');
const extension = require('./extension');
const workerpool = require('workerpool');

workerpool.worker({
  scaffold: scaffold,
  microservice: microservice,
  extension: extension,
});
