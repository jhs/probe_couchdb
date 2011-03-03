// Probe all details about a CouchDB database.
//

var lib = require('./lib')
  , util = require('util')
  , assert = require('assert')
  , Emitter = require('./emitter').Emitter
  , DesignDocument = require('./ddoc').DesignDocument
  ;

function Database () {
  var self = this;
  Emitter.call(self);

  self.couch = null;
  self.name = null;
  self.url = null;

  self.on('start', function probe_metadata() {
    self.log.debug("Fetching db metadata: " + self.url);
    self.request({uri:self.url}, function(er, resp, info) {
      if(er)
        throw er;
      else if(resp.statusCode === 401 && typeof info === 'object' && info.error === 'unauthorized')
        // Indicate no read permission.
        self.x_emit('metadata', null);
      else if(resp.statusCode === 200 && typeof info === 'object')
        self.x_emit('metadata', info);
      else
        throw new Error("Unknown db responses: " + JSON.stringify(info));
    })
  })

  self.on('start', function probe_security_object() {
    var sec_url = lib.join(self.url, '/_security');
    self.log.debug("Fetching db security data: " + sec_url);
    self.request({uri:sec_url}, function(er, resp, security) {
      if(er)
        throw er;
      else if(resp.statusCode === 401 && typeof security === 'object' && security.error === 'unauthorized')
        // Indicate no read permission.
        self.x_emit('security', null);
      else if(resp.statusCode === 200 && typeof security === 'object')
        self.x_emit('security', security);
      else
        throw new Error("Unknown db responses: " + JSON.stringify(security));
    })
  })

  self.on('start', function probe_ddocs() {
    var view = lib.join(self.url, '/_all_docs'
                                + '?include_docs=false'
                                + '&startkey=' + encodeURIComponent(JSON.stringify("_design/"))
                                + '&endkey='   + encodeURIComponent(JSON.stringify("_design0"))
                                                             );
    self.log.debug("Scanning for design documents: " + self.name);
    self.request({uri:view}, function(er, resp, body) {
      if(er)
        throw er;
      else if(resp.statusCode === 401 && typeof body === 'object' && body.error === 'unauthorized') {
        // Indicate no read permisssion.
        self.x_emit('ddoc_ids', null);
      } else if(resp.statusCode === 200 && ("rows" in body)) {
        var ids = body.rows.map(function(row) { return row.id });
        self.log.debug(self.name + ' has ' + ids.length + ' design documents: ' + ids.join(', '));
        self.x_emit('ddoc_ids', ids);
      } else
        throw new Error("Bad ddoc response from " + view + ": " + JSON.stringify({code:resp.statusCode, body:body}));
    })
  })

  self.on('ddoc_ids', function emit_ddoc_probes(ids) {
    self.log.debug('Creating probes for ' + ids.length + ' ddocs');
    ids.forEach(function(id) {
      var ddoc = new DesignDocument;
      ddoc.db = self.url;
      ddoc.id = id;
      self.x_emit('ddoc', ddoc);
      ddoc.start();
    })
  })
} // Database
util.inherits(Database, Emitter);

Database.prototype.start = function() {
  var self = this;

  if(!self.couch)
    throw new Error("Couch URL required");
  if(!self.name)
    throw new Error("Database name required");

  self.url = lib.join(self.couch, encodeURIComponent(self.name));
  self.x_emit('start');
}

module.exports = { "Database": Database
                 };
