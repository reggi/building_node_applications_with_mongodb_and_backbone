var express = require('express');
var app = express();
var nodemailer = require('nodemailer');
var MemoryStore = require('connect').session.MemoryStore;
var getRawBody = require('raw-body');
var bodyParser = require('body-parser');
var Cookies = require('cookies');
var Keygrip = require('keygrip');
var session = require('express-session');
var typer = require('media-typer');

keys = Keygrip(['SEKRIT2', 'SEKRIT1']);

// Import data layer
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/nodebackbone');
var config = {
  mail: require('./config/mail')
};

var Account = require('./models/Account')(config, mongoose, nodemailer);

app.set('view engine', 'jade');
app.use(express.static(__dirname + '/public'));

app.use(function(req, res, next) {
  //var contentType = req.headers['content-type'] || '',
      //mime = contentType.split(';')[0],
      //encoding = typer.parse(contentType).parameters.charset;

  req.on('data', function(chunk) {
    req.rawBody += chunk;
  });
  next();
});

// express.limit no longer supported
app.use(function(req, res, next) {
  getRawBody(req, {
    length: req.headers['content-length'],
    limit: '1mb',
    encoding: typer.parse(req.headers['content-type']).parameters.charset
  }, function(err, string) {
    if(err)
      return next(err);
    req.text = string;
    next();
  });
});

// express.bodyParser no longer supported
app.use(bodyParser.urlencoded());

// express.cookieParser no longer supported
app.use(Cookies.express(keys));
app.use(session(
  {secret: 'SocialNet secret key', store: new MemoryStore()}
));

app.get('/', function(req, res) {
  res.render('index.jade');
});

app.post('/login', function(req, res) {
  console.log('/login: start');
  var email = req.param('email', null);
  var password = req.param('password', null);

  if(null == email || email.length < 1 ||
     null == password || password.length < 1) {
    res.send(400);
    return;
  }

  Account.login(email, password, function(success) {
    if(!success) {
      console.log('/login: failed');
      res.send(401);
      return;
    }
    req.session.loggedIn = true;
    res.send(200);
    console.log('/login: end');
  });
});

app.post('/register', function(req, res) {
  console.log('/register: start');
  var firstName = req.param('firstName', '');
  var lastName = req.param('lastName', '');
  var email = req.param('email', null);
  var password = req.param('password', null);

  if(null == email || email.length < 1 ||
     null == password || password.length < 1) {
    res.send(400);
    console.log('/register: invalid fields');
    return;
  }

  // TODO: add failure reporting
  Account.register(email, password, firstName, lastName);
  res.send(200);
  console.log('/register: end');
});

app.get('/account/authenticated', function(req, res) {
  if(req.session.loggedIn) {
    res.send(200);
  } else {
    res.send(401);
  }
});

app.post('/forgotpassword', function(req, res) {
  var hostname = req.headers.host;
  var resetPasswordUrl = 'http://' + hostname + '/resetPassword';
  var email = req.param('email', null);
  if(null == email || email.length < 1){
    res.send(400);
    return;
  }

  Account.forgotPassword(email, resetPasswordUrl, function(success) {
    if(success) {
      res.send(200);
    } else {
      // Username or password not found
      res.send(400);
    }
  });
});

app.get('/resetPassword', function(req, res) {
  var accountId = req.param('account', null);
  res.render('resetPassword.jade', {locals:{accountId:accountId}});
});

app.post('/resetPassword', function(req, res) {
  var accountId = req.param('accountId', null);
  var password = req.param('password', null);
  if( null != accountId && null != password) {
    Account.changePassword(accountId, password);
  }
  res.render('resetPasswordSuccess.jade');
});

app.listen(8080);
