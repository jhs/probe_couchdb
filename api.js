// The probe_couchdb API
//

module.exports = { "CouchDB"       : require('./couch').CouchDB
                 , "Database"      : require('./db').Database
                 , "DesignDocument": require('./ddoc').DesignDocument
                 }
