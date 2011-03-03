// Miscellaneous helpers
//

// log4js is optional.
function getLogger(label) {
  var log;
  try {
    log = require('log4js')().getLogger(scrub_creds(label || 'audit_couchdb'));
    log.setLevel('info');
  } catch(e) {
    log = { "trace": function() {}
          , "debug": function() {}
          , "info" : console.log
          , "warn" : console.log
          , "error": console.log
          , "fatal": console.log
          }
    log.setLevel = function noop() {};
  }

  // Scrub credentials.
  ; ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].forEach(function(level) {
    var inner = log[level];
    log[level] = function log_scrubbed() {
      var args = Array.prototype.slice.apply(arguments);
      args[0] = scrub_creds(args[0]);
      return inner.apply(this, args);
    }
  })

  return log;
}

var url_parts = /(https?:\/\/)([^:]+:[^@]+@)?(.*)$/;

function get_creds(url) {
  var match = url_parts.exec(url);
  if(!match)
    throw new Error("Cannot parse URL: " + url);
  var auth = match[2];
  match = /^(.*?):(.*)@$/.exec(auth);
  if(!match)
    return [null, null];
  return [match[1], match[2]];
}

function scrub_creds(url) {
  if(typeof url === 'string')
    url = url.replace(url_parts, '$1$3'); // Scrub username and password
  return url;
}

function join_and_fix_slashes() {
  return Array.prototype.map.apply(arguments, [function trimmed(arg) {
    return arg.replace(/^\/+/, "").replace(/\/+$/, "");
  }]).join('/');
}


module.exports = { "getLogger"  : getLogger
                 , "join"       : join_and_fix_slashes
                 , "get_creds"  : get_creds
                 };
