// mpd-music-sync
// app.js
// -*- coding: utf-8 -*-
// vim:fenc=utf-8
// vim:foldmethod=syntax
// vim:foldnestmax=1
//
"use strict;"

var child_process = require('child_process');
var http = require('http');
var fs = require('fs');
var path = require('path');
var temp = require('temp');
var mpd = require('mpd');
var cmd = mpd.cmd;
var config = require('./config');

function prepareArgs(args, dir) {
  return args.map(function(a) {
    return a.replace('%m', dir);
  });
}

function parseList(main, msg) {
  var list = [];
  var cur = null
  msg.split('\n').forEach(function(mg) {
    if (mg.length === 0)
      return;
    var a = /^([A-Z_0-9-]+): (.*)$/i.exec(mg);
    if (a[1] === main) {
      if (cur !== null) list.push(cur);
      cur = {};
    }
    cur[a[1]] = a[2];
  });
  if (cur !== null)
    list.push(cur);
  return list;
}

function resolvePath(string) {
  if (string.substr(0, 1) === '~')
    string = process.env.HOME + string.substr(1)
  return path.resolve(string)
}

function mtpMount(dir, callback) {
  var args = prepareArgs(config.mtp.args, dir);
  unmountArgs = prepareArgs(config.mtp.unmount.args, dir);

  child_process.execFile(config.mtp.command, args, function(err, stdout, stderr) {
    if (err) {
      console.error(' [#] Error executing', config.mtp.command, args, ':', err.message);
      console.error('\n', stdout.toString());
      console.error('\n', stderr.toString());
      exit(1);
    }
    callback();
  });
}

var musicPath = resolvePath(config.mpd.music_directory);
var unmountArgs = null;
var mountPath = null;
var playlistFile = null;

var client = mpd.connect({
  port: config.mpd.port,
  host: config.mpd.host
});

client.on('ready', function() {
  client.sendCommand(cmd('listplaylist', [config.mpd.playlist]), function(err, msg) {
    if (err) {
      console.error(' [#] Error finding playlist', config.mpd.playlist + ':', err.message);
      exit(1);
    }
    var files = parseList('file', msg).map(function(f) {
      var p = path.join(musicPath, f.file);
      if (!fs.existsSync(p)) {
        console.error(' [#] File', p, 'doesn\'t exists! Check if the music directory is ok');
        exit(1);
      }
      var res = '';
      for (var i = 0; i < f.file.length; i++) {
        if ('[]*?\\&'.indexOf(f.file[i]) >= 0)
          res += '\\'
        res += f.file[i];
      }
      return res;
    });
    playlistFile = temp.openSync('playlist_');
    var b = new Buffer(files.join('\n'));
    fs.writeSync(playlistFile.fd, b, 0, b.length);
    fs.closeSync(playlistFile.fd);

    mountPath = temp.mkdirSync('mtp_');
    mtpMount(mountPath, function() {
      var destinationDir = path.join(mountPath, config.sync.destination);

      var rsyncArgs = [
        '-a', '-W', '--size-only', '--delete', '--delete-excluded', '--include-from',
        playlistFile.path, '--include', '*/', '--exclude', '*',
        '--prune-empty-dirs'];
        if (config.rsync.progress)
          rsyncArgs.push('--progress');
      rsyncArgs.push(musicPath + path.sep);
      rsyncArgs.push(destinationDir);

      var sp = child_process.spawn(config.rsync.command, rsyncArgs, {
        stdio: 'inherit'
      });

      sp.on('close', function(code) {
        if (code !== 0)
          console.error(' [#] Error executing', config.rsync.command);
        exit(code);
      });
    });
  });
});

client.on('error', function(err) {
  console.error(' [#] Error connecting to MPD', err.message);
  exit(1);
});

function exit(code) {
  if (unmountArgs !== null) {
    child_process.execFile(config.mtp.unmount.command, unmountArgs, function(err) {
      _exit(code);
    });
  } else {
    _exit(code);
  }
}

function _exit(code) {

  console.log(' [+] Cleaning temporary files');

  if (playlistFile !== null)
    fs.unlinkSync(playlistFile.path);
  if (mountPath !== null && fs.readdirSync(mountPath).length > 0)
    fs.rmdirSync(mountPath);

  process.exit(code);
}
