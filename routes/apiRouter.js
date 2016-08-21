var express = require('express');
var apiRouter = express.Router();
var bodyparser=require('body-parser');
var path = require('path');
var mongoose = require('mongoose');
apiRouter.use(bodyparser.json());
apiRouter.use(bodyparser.urlencoded());
var Show=require('../models/showSchema');
var async = require('async');
var _ = require('lodash');
var request = require('request');
var xml2js = require('xml2js');
var sugar = require('sugar');
var agenda=require('../config/notification');
var fs=require('fs');
/* GET home page. */
var alertDate = new sugar.Date.create('next friday');
console.log(alertDate);
alertDate.setDate(alertDate.getDate()-2);
console.log(alertDate);
apiRouter.get('/shows', function(req, res, next) {
  var query ;
  if (req.query.genre) {
  query=Show.aggregate({ $match: {genre:req.query.genre}},{$project: {
        name: 1,
        poster: 1,
        episodeCount: {$size: '$episodes'}
    }});
    //query=Show.find({ genre: req.query.genre });
  //  query.where({ genre: req.query.genre });
  } else if (req.query.alphabet) {
    query=Show.aggregate({ $match: { name: new RegExp('^' + '[' + req.query.alphabet + ']', 'i') }},{$project: {
          name: 1,
          poster: 1,
          episodeCount: {$size: '$episodes'}
      }});
    //query.where({ name: new RegExp('^' + '[' + req.query.alphabet + ']', 'i') });
  } else {
    query=Show.aggregate({ $sort : { rating:1 } },{$project: {
          name: 1,
          poster: 1,
          episodeCount: {$size: '$episodes'}
      }}).limit(12);
  }
  query.exec(function(err, shows) {
    if (err) return next(err);
    res.send(shows);
  });
});

apiRouter.post('/shows', function(req, res, next) {
  var apiKey = '3C7A72D824EE189F';
  var parser = xml2js.Parser({
    explicitArray: false,
    normalizeTags: true
  });
  var seriesName = req.body.showName
    .toLowerCase()
    .replace(/ /g, '_')
    .replace(/[^\w-]+/g, '');

  async.waterfall([
    function(callback) {
      var option={
        url: 'http://thetvdb.com/api/GetSeries.php?seriesname='+seriesName,
        //proxy: 'http://192.168.3.1:8080'
      };
      request.get(option, function(error, response, body) {
        if (error) return next(error);
        parser.parseString(body, function(err, result) {
          if (!result.data.series) {
            return res.send(404, { message: req.body.showName + ' was not found.' });
          }
          var seriesId = result.data.series.seriesid || result.data.series[0].seriesid;
          callback(err, seriesId);
        });
      });
    },
    function(seriesId, callback) {
      var option={
        url:'http://thetvdb.com/api/' + apiKey + '/series/' + seriesId + '/all/en.xml',
        //proxy: 'http://192.168.3.1:8080'
      };
      request.get(option, function(error, response, body) {
        if (error) return next(error);
        parser.parseString(body, function(err, result) {
          var series = result.data.series;
          var episodes = result.data.episode;
          var show = new Show({
            _id: series.id,
            name: series.seriesname,
            airsDayOfWeek: series.airs_dayofweek,
            airsTime: series.airs_time,
            firstAired: series.firstaired,
            genre: series.genre.split('|').filter(Boolean),
            network: series.network,
            overview: series.overview,
            rating: series.rating,
            ratingCount: series.ratingcount,
            runtime: series.runtime,
            status: series.status,
            poster: series.poster,
            episodes: []
          });
          _.each(episodes, function(episode) {
            show.episodes.push({
              season: episode.seasonnumber,
              episodeNumber: episode.episodenumber,
              episodeName: episode.episodename,
              firstAired: episode.firstaired,
              overview: episode.overview
            });
          });
          callback(err, show);
        });
      });
    },
    function(show, callback) {
      var url = 'http://thetvdb.com/banners/' + show.poster;
      request({ url: url, encoding: null }, function(error, response, body) {
        show.poster = 'data:' + response.headers['content-type'] + ';base64,' + body.toString('base64');
        callback(error, show);
      });
      //comment the above lines of code and uncomment the below lines of code if
      //you want to save the posters in the posters folder inside public dir
      /*var option={
          url:'http://thetvdb.com/banners/' + show.poster,
          //proxy: 'http://192.168.3.1:8080',
          encoding:'binary'
      };
      request.get(option, function (err, response, body) {
        var imagepath=path.join(__dirname, '../public/'+show.poster);
        fs.writeFile(imagepath, body, 'binary', function(err) {
          if(err)
            console.log(err);
          else
            show.poster=show.poster;
            callback(err,show);
        });
      });*/
    }
  ], function(err, show) {
    if (err) return next(err);
    show.save(function(err) {
      var alertDate = sugar.Date.create('Next ' + show.airsDayOfWeek + ' at ' + show.airsTime);
      alertDate.setHours(alertDate.getHours()-2);
      console.log(alertDate);
      agenda.schedule(alertDate, 'send email alert', show.name).repeatEvery('1 week');
      //var alertDate = sugar.Date.create('Next ' + show.airsDayOfWeek + ' at ' + show.airsTime).rewind({ hour: 2});
      //agenda.schedule(alertDate, 'send email alert', show.name).repeatEvery('1 week');
      if (err) {
        if (err.code == 11000) {
          return res.send(409, { message: show.name + ' already exists.' });
        }
        return next(err);
      }
      res.sendStatus(200);
    });
  });
});


apiRouter.get('/shows/:id', function(req, res, next) {
  Show.findById(req.params.id, function(err, show) {
    if (err) return next(err);
    res.send(show);
  });
});


apiRouter.post('/subscribe', ensureAuthenticated, function(req, res, next) {
  Show.findById(req.body.showId, function(err, show) {
    if (err) return next(err);
    show.subscribers.push(req.user.id);
    show.save(function(err) {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
});

apiRouter.post('/unsubscribe', ensureAuthenticated, function(req, res, next) {
  Show.findById(req.body.showId, function(err, show) {
    if (err) return next(err);
    var index = show.subscribers.indexOf(req.user.id);
    show.subscribers.splice(index, 1);
    show.save(function(err) {
      if (err) return next(err);
      res.send(200);
    });
  });
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) next();
  else res.send(401);
}
module.exports = apiRouter;
