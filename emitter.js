// Core routines for event emitters
//

var lib = require('./lib')
  , util = require('util')
  , events = require('events')
  , request = require('request')
  ;

function Emitter (log_label) {
  var self = this;
  events.EventEmitter.call(self);

  self.log = lib.getLogger(log_label ? ('probe_couchdb.'+log_label) : 'probe_couchdb');

} // Emitter
util.inherits(Emitter, events.EventEmitter);

Emitter.prototype.request = function request_wrapper(opts, callback) {
  var self = this;

  function json_body(er, resp, body) {
    if(!er) {
      try      { body = JSON.parse(body) }
      catch(e) { er = e }
    }

    // TODO: Maybe set self.client = resp.client?
    return callback && callback.apply(this, [er, resp, body]);
  }

  opts.proxy  = opts.proxy  || self.proxy || process.env.http_proxy;
  opts.client = opts.client || self.client;
  opts.followRedirect = false;

  opts.headers = opts.headers || {};
  opts.headers.accept = opts.headers.accept || 'application/json';
  //opts.headers.Connection = opts.headers.Connection || 'keep-alive';

  if(opts.method && opts.method !== "GET" && opts.method !== "HEAD")
    opts.headers['content-type'] = 'application/json';

  return request.apply(self, [opts, json_body]);
}

// If event A triggers event B, B should wait to emit until A is finished.
Emitter.prototype.x_emit = function push_emit() {
  var self = this
    , args = arguments;

  process.nextTick(function() { self.emit.apply(self, args) })
}

module.exports = { "Emitter" : Emitter
                 };
