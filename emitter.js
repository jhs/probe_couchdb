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

  // Callbacks can register for "known" states either before or after the information
  // actually becomes known. If before, they will queue up until it is known, then run
  // in order. Susequent "known" calls will call back immediately.
  self.known_state = {};

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

Emitter.prototype.known = function on_known(name, cb, newval) {
  var self = this;
  if(!self.known_state[name])
    self.known_state[name] = { known: false
                             , value: undefined
                             , callbacks: []
                             };

  var state = self.known_state[name];
  if(cb) {
    // Fetch the value (either call back now, or register when it is known.
    if(! state.known)
      state.callbacks.push(cb)
    else
      return cb && cb.apply(undefined, [state.value]);
  } else {
    // Store the value, calling back any pending callbacks.
    state.known = true;
    state.value = newval;
    state.callbacks.forEach(function(cb) {
      cb && cb.apply(undefined, [newval]);
    })
    state.callbacks = [];
  }
}

// If event A triggers event B, B should wait to emit until A is finished.
Emitter.prototype.x_emit = function push_emit() {
  var self = this
    , args = arguments;

  process.nextTick(function() {
    // Actually emit the event.
    self.emit.apply(self, args)

    // Also register that the value is known.
    self.known(args[0], null, args[1]);
  })
}

module.exports = { "Emitter" : Emitter
                 };
