# The Android Geek Music Synchronizer

A geeky way to sync music to you Android phone whitout using fancy GUI based stuff


## What is it

This project is no more than a Proof of Concept, however it could be improved, modularized etc.. For now, this software is intended for those that use MPD to listen to music and want to sync to the Android Phone a specific playlist.

## Dependencies

* Rsync
* Your favorite fuse mtp mount program (e.g. jmtpfs)
* MDP

## Usage

* The program is partially configurable via `config.json`.
* Create you playlist in MPD
* Launch `node app.js` to sync you android phone!
* **NOTE**: the application will **erase everything inside the specified Android music directory** that is not in the playlist. You can bypass this by specifying a subdirectory where to sync your playlist. The default directory is `SD card/Android/Music`.
