var Agenda=require('agenda');
var nodemailer = require('nodemailer');
var Show=require('../models/showSchema');
var smtpTransport = require("nodemailer-smtp-transport")
var agenda = new Agenda({
  db: { address: 'mongodb://localhost:27017/test' }
}, function(err) {
  if (err) {
    console.log(err);
    throw err;
  }
  agenda.emit('ready');
  agenda.start();
});


agenda.define('send email alert', function(job, done) {
  Show.findOne({ name: job.attrs.data }).populate('subscribers').exec(function(err, show) {
    var emails = show.subscribers.map(function(user) {
      return user.email;
    });

    var upcomingEpisode = show.episodes.filter(function(episode) {
      return new Date(episode.firstAired) > new Date();//change it to > later
    })[0];
    var options = {
      service: "Gmail",  // sets automatically host, port and connection security settings
      auth: {
          user: "souravprem77@gmail.com",
           pass: "kbxfetvaqgncrqlc"
      }
      };
    var transporter = nodemailer.createTransport(smtpTransport(options));
    var mailOptions = {
      from: 'souravprem77@gmail.com',
      to: emails.join(','),
      subject: show.name + ' is starting soon!',
      text: show.name + ' starts in less than 2 hours on ' + show.network + '.\n\n' +
        'Episode ' + upcomingEpisode.episodeNumber + ' Overview\n\n' + upcomingEpisode.overview
    };
    console.log( mailOptions);
    console.log(emails);
    transporter.sendMail(mailOptions, function(error, response) {
      console.log(response);
      console.log('Message sent: ' + response.message);
      done();
    });
  });
});

agenda.define('send email report', {priority: 'high', concurrency: 10}, function(job, done) {
  var data = job.attrs.data;
  console.log(data);

var options = {
  service: "Gmail",  // sets automatically host, port and connection security settings
  auth: {
      user: "souravprem77@gmail.com",
       pass: "kbxfetvaqgncrqlc"
  }
  };
  // create reusable transporter object using the default SMTP transport
  var transporter = nodemailer.createTransport(smtpTransport(options));
  // setup e-mail data with unicode symbols
  var mailOptions = {
      from: 'souravprem77@gmail.com', // sender address
      to: 'sourav.prem@mypat.in', // list of receivers
      subject: 'Hello ✔', // Subject line
      text: 'Hello world 🐴', // plaintext body
      html: '<b>Hello world 🐴</b>' // html body
  };

  // send mail with defined transport object
  transporter.sendMail(mailOptions, function(error, response){
      if(error){
          console.log(error);
      }else{
          console.log("Message sent: " + response.message);
      }
        done();
  });
});
/*agenda.on('ready', function() {
  agenda.schedule('in 2 minutes', 'send email report', {to: 'sourav.prem@mypat.in'});
  //agenda.start();
});
*/
agenda.on('start', function(job) {
  console.log("Job %s starting", job.attrs.name);
});

agenda.on('complete', function(job) {
  console.log("Job %s finished", job.attrs.name);
});
module.exports=agenda;
