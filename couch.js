// Probe all details about a CouchDB.
//

var lib = require('./lib')
  , util = require('util')
  , Emitter = require('./emitter').Emitter
  , Database = require('./db').Database
  ;

var MAX_USER_DEFAULT = 1000;

function CouchDB () {
  var self = this;
  Emitter.call(self);

  self.url = null;
  self.only_dbs = null;
  self.max_users = MAX_USER_DEFAULT;

  self.on('start', function ping_root() {
    self.log.debug("Pinging: " + self.url);
    self.request({uri:self.url}, function(er, resp, body) {
      if(er)
        throw er;
      else if(resp.statusCode !== 200 || body.couchdb !== "Welcome")
        throw new Error("Bad welcome from " + self.url + ": " + JSON.stringify(body));
      else
        self.x_emit('couchdb', body);
    })
  })

  self.on('couchdb', function probe_databases(hello) {
    var all_dbs = lib.join(self.url, '/_all_dbs');
    self.log.debug("Scanning databases: " + all_dbs);
    self.request({uri:all_dbs}, function(er, resp, body) {
      if(er) throw er;
      if(resp.statusCode !== 200 || !Array.isArray(body))
        throw new Error("Bad _all_dbs from " + all_dbs + ": " + JSON.stringify(body));

      self.log.debug(self.url + ' has ' + body.length + ' databases');
      var dbs = body.filter(function(db) { return !self.only_dbs || self.only_dbs.indexOf(db) !== -1 });
      self.x_emit('dbs', dbs);
    })
  })

  self.on('dbs', function emit_db_probes(dbs) {
    self.log.debug('Creating probes for ' + dbs.length + ' dbs');
    dbs.forEach(function(db_name) {
      var db = new Database;
      db.couch = self.url;
      db.name = db_name;
      self.x_emit('db', db);
      db.start();
    })
  })

  self.on('couchdb', function probe_session(hello) {
    var session_url = lib.join(self.url, '/_session');
    self.log.debug("Checking login session: " + session_url);
    self.request({uri:session_url}, function(er, resp, session) {
      if(er) throw er;
      if(resp.statusCode !== 200 || (!session) || session.ok !== true)
        throw new Error("Bad _session from " + session_url + ": " + JSON.stringify(session));

      self.log.debug("Received session: " + JSON.stringify(session));
      if( ((session.userCtx || {}).roles || []).indexOf('_admin') === -1 )
        self.log.warn("Results will be incomplete without _admin access");
      self.x_emit('session', session);
    })
  })

  self.on('couchdb', function(hello) {
    var config_url = lib.join(self.url, '/_config');
    self.log.debug("Checking config: " + config_url);
    self.request({uri:config_url}, function(er, resp, config) {
      if(er) throw er;
      if(resp.statusCode !== 200 || (typeof config !== 'object')) {
        self.log.debug("Bad config response: " + JSON.stringify(config));
        config = null;
      }
      self.x_emit('config', config);
    })
  })

  self.on('config', function(config) {
    // Once the config is known, the list of users can be established.
    var auth_db = config && config.couch_httpd_auth && config.couch_httpd_auth.authentication_db;
    if(!auth_db) {
      auth_db = '_users';
      self.log.warn('authentication_db not found in config; trying ' + JSON.stringify(auth_db));
    }

    // Of course, the anonymous user is always known to exist.
    var anonymous_users = [ { name:null, roles: [] } ];

    var auth_db_url = lib.join(self.url, encodeURIComponent(auth_db).replace(/^_design%2[fF]/, '_design/'));
    self.log.debug("Checking auth_db: " + auth_db_url);
    self.request({uri:auth_db_url}, function(er, resp, body) {
      if(er) throw er;
      if(resp.statusCode !== 200 || typeof config !== 'object') {
        self.log.warn("Can not access authentication_db: " + auth_db_url);
        // Signal the end of the users discovery.
        self.x_emit('users', anonymous_users);
      } else if(body.doc_count > self.max_users) {
        throw new Error("Too many users; you must add a view to process them");
        // TODO
      } else {
        var users_query = lib.join(auth_db_url, '/_all_docs'
                                              + '?include_docs=true'
                                              + '&startkey=' + encodeURIComponent(JSON.stringify("org.couchdb.user:"))
                                              + '&endkey='   + encodeURIComponent(JSON.stringify("org.couchdb.user;"))
                                              );
        self.log.debug("Fetching all users: " + users_query);
        self.request({uri:users_query}, function(er, resp, body) {
          if(er) throw er;
          if(resp.statusCode !== 200 || !Array.isArray(body.rows))
            throw new Error("Failed to fetch user listing from " + users_query + ": " + JSON.stringify(body));

          var users = body.rows.map(function(row) { return row.doc });
          self.log.debug("Found " + (users.length+1) + " users (including anonymous): " + auth_db_url);
          self.x_emit('users', anonymous_users.concat(users));
        })
      }
    })
  })
} // CouchDB

util.inherits(CouchDB, Emitter);

CouchDB.prototype.start = function() {
  var self = this;

  if(!self.url)
    throw new Error("url required");

  self.x_emit('start');
}

module.exports = { "CouchDB": CouchDB
                 };
