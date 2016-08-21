var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var compress = require('compression')
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var app = express();
var User=require('./models/userSchema');
var session = require('express-session');
var apiRouter=require('./routes/apiRouter');
mongoose.connect('mongodb://sourav:prem2029@ds013366.mlab.com:13366/showtrakr')
//mongoose.connect('mongodb://localhost:27017/test');
app.disable('etag');
// uncomment after placing your favicon in /public

//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(compress())
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({ secret: 'Sourav Prem' }));
var passport=require('passport');
var LocalStrategy = require('passport-local').Strategy;
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 86400000 }));
app.use(function(req, res, next) {
  if (req.user) {
    console.log("Inside res.cookie()");
    res.cookie('user', JSON.stringify(req.user));
  }
  next();
});


passport.serializeUser(function(user, done) {
  console.log("Inside serialise");
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  console.log("Inside deserialise");
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new LocalStrategy({ usernameField: 'email' }, function(email, password, done) {
  User.findOne({ email: email }, function(err, user) {
    if (err) return done(err);
    if (!user) return done(null, false);
    user.comparePassword(password, function(err, isMatch) {
      if (err) return done(err);
      if (isMatch) return done(null, user);
      return done(null, false);
    });
  });
}));


//authentication function
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) next();
  else res.send(401);
}


app.post('/api/login', passport.authenticate('local'), function(req, res) {
  res.cookie('user', JSON.stringify(req.user));
  res.send(req.user);
});

app.post('/api/signup', function(req, res, next) {
  var user = new User({
    email: req.body.email,
    password: req.body.password
  });
  user.save(function(err) {
    if (err) return next(err);
    res.send(200);
  });
});

app.get('/api/logout', function(req, res, next) {
  req.logout();
  res.send(200);
});

app.use('/api',apiRouter);


/*HTML5 pushState*/
app.get('*', function(req, res) {
  res.redirect('/#' + req.originalUrl);
});

app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.send(500, { message: err.message });
});

module.exports=app;
