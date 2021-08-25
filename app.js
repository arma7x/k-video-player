function convertTime(time) {
  if (isNaN(time)) {
    return '00:00';
  }
  var mins = Math.floor(time / 60);
  if (mins < 10) {
    mins = '0' + String(mins);
  }
  var secs = Math.floor(time % 60);
  if (secs < 10) {
    secs = '0' + String(secs);
  }
  return mins + ':' + secs;
}

function srt2webvtt(data) {
  var srt = data.replace(/\r+/g, '');
  srt = srt.replace(/^\s+|\s+$/g, '');
  var cuelist = srt.split('\n\n');
  var result = "";
  if (cuelist.length > 0) {
    result += "WEBVTT\n\n";
    for (var i = 0; i < cuelist.length; i=i+1) {
      result += convertSrtCue(cuelist[i]);
    }
  }
  return result;
}

function convertSrtCue(caption) {
  var cue = "";
  var s = caption.split(/\n/);
  while (s.length > 3) {
      for (var i = 3; i < s.length; i++) {
          s[2] += "\n" + s[i]
      }
      s.splice(3, s.length - 3);
  }
  var line = 0;
  if (!s[0].match(/\d+:\d+:\d+/) && s[1].match(/\d+:\d+:\d+/)) {
    cue += s[0].match(/\w+/) + "\n";
    line += 1;
  }
  if (s[line].match(/\d+:\d+:\d+/)) {
    var m = s[1].match(/(\d+):(\d+):(\d+)(?:,(\d+))?\s*--?>\s*(\d+):(\d+):(\d+)(?:,(\d+))?/);
    if (m) {
      cue += m[1]+":"+m[2]+":"+m[3]+"."+m[4]+" --> "
            +m[5]+":"+m[6]+":"+m[7]+"."+m[8]+"\n";
      line += 1;
    } else {
      return "";
    }
  } else {
    return "";
  }
  if (s[line]) {
    cue += s[line] + "\n\n";
  }
  return cue;
}

window.addEventListener("load", function() {

  localforage.setDriver(localforage.LOCALSTORAGE);

  const state = new KaiState({});

  const helpSupportPage = new Kai({
    name: 'helpSupportPage',
    data: {
      title: 'helpSupportPage'
    },
    templateUrl: document.location.origin + '/templates/helpnsupport.html',
    mounted: function() {
      this.$router.setHeaderTitle('Help & Support');
      navigator.spatialNavigationEnabled = false;
    },
    unmounted: function() {},
    methods: {},
    softKeyText: { left: '', center: '', right: '' },
    softKeyListener: {
      left: function() {},
      center: function() {},
      right: function() {}
    }
  });

  const player = function($router, id, name, video, subtitle = null) {
    var VOLUME = 0;
    $router.push(
      new Kai({
        name: 'player',
        data: {
          title: 'player',
          width: 1,
          height: 1,
          ration: 1,
        },
        templateUrl: document.location.origin + '/templates/player.html',
        mounted: function() {
          localforage.getItem('RESUME_LOGS')
          .then((RESUME_LOGS) => {
            if (RESUME_LOGS == null) {
              RESUME_LOGS = {}
            }
            const RESUME_AT = RESUME_LOGS[id];
            var vplayer = document.getElementById('vplayer');
            vplayer.onloadedmetadata = (evt) => {
              this.data.ratio = evt.target.width / evt.target.height;
              vplayer.width = 240;
              vplayer.clientHeight = 240 / this.data.ratio;
              this.data.width = vplayer.width;
              this.data.height = vplayer.clientHeight;
              if (subtitle) {
                const track = document.createElement("track");
                track.kind = "captions";
                track.label = "English";
                track.srclang = "en";
                track.src = subtitle;
                track.setAttribute('default', true);
                track.addEventListener("load", function() {
                  this.mode = "showing";
                  vplayer.textTracks[0].mode = "showing";
                });
                vplayer.appendChild(track);
              }
            }
            vplayer.ontimeupdate = (e) => {
              var progress = (e.target.currentTime / e.target.duration) * 100;
              document.getElementById('vplayer_progress').style.width = `${progress}%`;
              document.getElementById('current-duration').innerHTML = convertTime(e.target.currentTime);
              document.getElementById('total-duration').innerHTML = convertTime(e.target.duration);
              RESUME_LOGS[id] = e.target.currentTime
              localforage.setItem('RESUME_LOGS', RESUME_LOGS);
            }
            vplayer.onended = (e) => {
              delete RESUME_LOGS[id];
              localforage.setItem('RESUME_LOGS', RESUME_LOGS);
              this.$router.setSoftKeyCenterText('PLAY');
            }
            vplayer.onvolumechange = (e) => {
              $router.showToast(`Volume ${Math.round((vplayer.volume + Number.EPSILON) * 100)}%`);
            }
            vplayer.onratechange = (e) => {
              const rate = Math.round((vplayer.playbackRate + Number.EPSILON) * 100) / 100;
              $router.showToast(`Playback Rate ${rate}x`);
              document.getElementById('playback-speed').innerHTML = rate;
            }
            vplayer.pause();
            vplayer.setAttribute('src', video);
            vplayer.load();
            if (RESUME_AT == null) {
              vplayer.play();
              this.$router.setSoftKeyCenterText('PAUSE');
            } else {
              this.$router.showDialog('Resume', 'Resume at last playback ?', null, 'Yes', () => {
                vplayer.currentTime = RESUME_AT;
              }, 'No', () => {
                vplayer.currentTime = 0;
              }, 'CANCEL', () => {}, () => {
                vplayer.play();
                this.$router.setSoftKeyCenterText('PAUSE');
              });
            }
            window['vplayer'] = vplayer;
          });
          document.addEventListener('keydown', this.methods.keydownListener);
        },
        unmounted: function() {
          window['vplayer'].pause();
          window['vplayer'] = null;
          document.removeEventListener('keydown', this.methods.keydownListener);
          displayKaiAds();
        },
        methods: {
          keydownListener: function(evt) {
            if (evt.key === 'Call') {
              var video = document.getElementById('vplayer');
              var canvas = document.querySelector('canvas');
              var context = canvas.getContext('2d');
              canvas.width = video.width;
              canvas.height = video.clientHeight;
              context.fillRect(0, 0, video.width, video.clientHeight);
              context.drawImage(video, 0, 0, video.width, video.clientHeight);
              canvas.toBlob((blob) => {
                saveAs(blob, `${name}_${new Date().getTime().toString()}.png`); 
              }, 'image/png', 1);
            } else if (evt.key === '1') {
              if (window['vplayer'].playbackRate >= 0.1)
                window['vplayer'].playbackRate -= 0.1;
            } else if (evt.key === '2') {
              window['vplayer'].playbackRate = 1;
            } else if (evt.key === '3') {
              if (window['vplayer'].playbackRate <= 2)
                window['vplayer'].playbackRate += 0.1;
            } else if (evt.key === '4') {
              window['vplayer'].currentTime -= 30;
            } else if (evt.key === '6') {
              window['vplayer'].currentTime += 30;
            }
          }
        },
        softKeyText: { left: 'Fullscreen', center: '', right: 'Mute' },
        softKeyListener: {
          left: function() {
            if (!document.fullscreenElement) {
              document.getElementById('app').requestFullscreen();
              screen.orientation.lock('landscape');
              document.getElementById('vplayer').width = 320;
              document.getElementById('vplayer').clientHeight = (320 / this.data.ratio);
              this.$router.setSoftKeyLeftText('Exit Fullscreen');
              document.getElementById('__kai_soft_key__').style.display = 'none';
              $router.showToast('Click Back/EndCall to exit fullscreen');
              document.getElementById('vplayer').style.marginTop = '20px';
            } else {
              screen.orientation.unlock();
              document.exitFullscreen();
              document.getElementById('vplayer').width = this.data.width;
              document.getElementById('vplayer').clientHeight = this.data.height;
              this.$router.setSoftKeyLeftText('Fullscreen');
              document.getElementById('__kai_soft_key__').style.display = '';
              document.getElementById('vplayer').style.marginTop = '0px';
            }
          },
          center: function() {
            if (window['vplayer'].duration > 0 && !window['vplayer'].paused) {
              window['vplayer'].pause();
              $router.setSoftKeyCenterText('PLAY');
            } else {
              window['vplayer'].play();
              $router.setSoftKeyCenterText('PAUSE');
            }
          },
          right: function() {
            if (window['vplayer'].volume !== 0) {
              VOLUME = window['vplayer'].volume;
              window['vplayer'].volume = 0;
              $router.setSoftKeyRightText('Unmute');
            } else {
              window['vplayer'].volume = VOLUME;
              $router.setSoftKeyRightText('Mute');
            }
          }
        },
        dPadNavListener: {
          arrowUp: function() {
            if (navigator.volumeManager && navigator.mozAudioChannelManager) {
              navigator.volumeManager.requestShow();
            } else {
              if (window['vplayer'].volume !== 1) {
                window['vplayer'].volume += 0.02;
              }
            }
          },
          arrowRight: function() {
            window['vplayer'].currentTime += 10;
          },
          arrowDown: function() {
            if (navigator.volumeManager && navigator.mozAudioChannelManager) {
              navigator.volumeManager.requestShow();
            } else {
              if (window['vplayer'].volume !== 0) {
                window['vplayer'].volume -= 0.02;
              }
            }
          },
          arrowLeft: function() {
            window['vplayer'].currentTime -= 10;
          },
        },
        backKeyListener: function() {
          if (document.fullscreenElement) {
            screen.orientation.unlock();
            document.exitFullscreen();
            document.getElementById('vplayer').width = this.data.width;
            document.getElementById('vplayer').clientHeight = this.data.height;
            this.$router.setSoftKeyLeftText('Fullscreen');
            document.getElementById('__kai_soft_key__').style.display = '';
            document.getElementById('vplayer').style.marginTop = '0px';
            return true;
          } else {
            return false;
          }
        }
      })
    );
  }

  const homepage = new Kai({
    name: 'home',
    data: {
      title: 'home',
      videos: []
    },
    verticalNavClass: '.homeNav',
    templateUrl: document.location.origin + '/templates/home.html',
    mounted: function() {
      navigator.spatialNavigationEnabled = false;
      this.$router.setHeaderTitle('K-Video Player');
      localforage.getItem('VIDEOS')
      .then((videos) => {
        if (!videos) {
          window['__DS__'] = new DataStorage(this.methods.onChange, this.methods.onReady);
          setTimeout(() => {
            this.$router.showToast('Please `Kill App` if you think the app was hang');
          }, 30000);
        } else {
          this.setData({videos: videos});
        }
      });
    },
    unmounted: function() {
      if (window['__DS__']) {
        window['__DS__'].destroy();
      }
    },
    methods: {
      selected: function() {},
      onChange: function(fileRegistry, documentTree, groups) {
        const videos = groups['video'];
        this.methods.runFilter(videos || []);
      },
      onReady: function(status) {
        if (status) {
          this.$router.hideLoading();
        } else {
          this.$router.showLoading(false);
        }
      },
      runFilter: function(fileRegistry) {
        var videos = []
        fileRegistry.forEach((file) => {
          var n = file.split('/');
          var n1 = n[n.length - 1];
          videos.push({'name': n1, 'path': file});
        });
        videos.sort((a,b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0))
        this.setData({videos: videos});
        localforage.setItem('VIDEOS', videos);
      },
      search: function(keyword) {
        this.verticalNavIndex = -1;
        localforage.getItem('VIDEOS')
        .then((videos) => {
          if (!videos) {
            videos = [];
          }
          var result = [];
          videos.forEach((rom) => {
            if (keyword === '' || (rom.name.toLowerCase().indexOf(keyword.toLowerCase()) > -1)) {
              result.push(rom);
            }
          });
          result.sort((a,b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0))
          this.setData({videos: result});
        });
      }
    },
    softKeyText: { left: 'Menu', center: 'SELECT', right: 'Kill App' },
    softKeyListener: {
      left: function() {
        var menu = [
          {'text': 'Search'},
          {'text': 'Reload Library'},
          {'text': 'Help & Support'},
        ]
        this.$router.showOptionMenu('Menu', menu, 'SELECT', (selected) => {
          if (selected.text === 'Reload Library') {
            window['__DS__'] = new DataStorage(this.methods.onChange, this.methods.onReady);
          } else if (selected.text === 'Help & Support') {
            this.$router.push('helpSupportPage');
          } else if (selected.text === 'Search') {
            const searchDialog = Kai.createDialog('Search', '<div><input id="search-input" placeholder="Enter your keyword" class="kui-input" type="text" /></div>', null, '', undefined, '', undefined, '', undefined, undefined, this.$router);
            searchDialog.mounted = () => {
              setTimeout(() => {
                setTimeout(() => {
                  this.$router.setSoftKeyText('Cancel' , '', 'Go');
                }, 103);
                const SEARCH_INPUT = document.getElementById('search-input');
                if (!SEARCH_INPUT) {
                  return;
                }
                SEARCH_INPUT.focus();
                SEARCH_INPUT.addEventListener('keydown', (evt) => {
                  switch (evt.key) {
                    case 'Backspace':
                    case 'EndCall':
                      if (document.activeElement.value.length === 0) {
                        this.$router.hideBottomSheet();
                        setTimeout(() => {
                          SEARCH_INPUT.blur();
                        }, 100);
                      }
                      break
                    case 'SoftRight':
                      this.$router.hideBottomSheet();
                      setTimeout(() => {
                        SEARCH_INPUT.blur();
                        this.methods.search(SEARCH_INPUT.value);
                      }, 100);
                      break
                    case 'SoftLeft':
                      this.$router.hideBottomSheet();
                      setTimeout(() => {
                        SEARCH_INPUT.blur();
                      }, 100);
                      break
                  }
                });
              });
            }
            searchDialog.dPadNavListener = {
              arrowUp: function() {
                const SEARCH_INPUT = document.getElementById('search-input');
                SEARCH_INPUT.focus();
              },
              arrowDown: function() {
                const SEARCH_INPUT = document.getElementById('search-input');
                SEARCH_INPUT.focus();
              }
            }
            this.$router.showBottomSheet(searchDialog);
          }
        }, null);
      },
      center: function() {
        var video = this.data.videos[this.verticalNavIndex];
        if (video) {
          var DS;
          if (window['__DS__']) {
            DS = window['__DS__'];
          }
          else {
            DS = new DataStorage();
          }
          var vtt_path;
          var srt_path;
          var paths = video.path.split('/');
          var names = paths[paths.length - 1].split('.');
          if (names.length > 1) {
            const ext = names[names.length - 1];
            srt_path = video.path.replace(new RegExp(ext), 'srt');
            vtt_path = video.path.replace(new RegExp(ext), 'vtt');
          } else {
            srt_path = video.path + '.srt';
            vtt_path = video.path + '.vtt';
          }
          const hashids2 = new Hashids(video.path, 15);
          const _vid = hashids2.encode(1);
          DS.getFile(video.path, (blobVideo) => {
            DS.getFile(vtt_path, (blobVtt) => {
              player(this.$router, _vid, names[0], URL.createObjectURL(blobVideo), URL.createObjectURL(blobVtt));
            }, (err) => {
              DS.getFile(srt_path, (blobSrt) => {
                var reader = new FileReader();
                reader.readAsText(blobSrt);
                reader.onload = () => {
                  const _vtt = srt2webvtt(reader.result);
                  var _vttBlob = new Blob([_vtt], {type: "text/vtt"});
                  player(this.$router, _vid, names[0], URL.createObjectURL(blobVideo), URL.createObjectURL(_vttBlob));
                }
                reader.onerror = () => {
                  player(this.$router, _vid, names[0], URL.createObjectURL(blobVideo), null);
                }
              }, (err) => {
                player(this.$router, _vid, names[0], URL.createObjectURL(blobVideo), null);
              });
            });
          }, (err) => {
            this.$router.showToast(err.toString());
          })
        }
      },
      right: function() {
        window.close();
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowRight: function() {
        //this.navigateTabNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      },
      arrowLeft: function() {
        //this.navigateTabNav(1);
      },
    },
    backKeyListener: function() {}
  });

  const router = new KaiRouter({
    title: 'K-Video Player',
    routes: {
      'index' : {
        name: 'homepage',
        component: homepage
      },
      'helpSupportPage': {
        name: 'helpSupportPage',
        component: helpSupportPage
      },
    }
  });

  const app = new Kai({
    name: '_APP_',
    data: {},
    templateUrl: document.location.origin + '/templates/template.html',
    mounted: function() {},
    unmounted: function() {},
    router,
    state
  });

  try {
    app.mount('app');
  } catch(e) {
    console.log(e);
  }

  function displayKaiAds() {
    var display = true;
    if (window['kaiadstimer'] == null) {
      window['kaiadstimer'] = new Date();
    } else {
      var now = new Date();
      if ((now - window['kaiadstimer']) < 300000) {
        display = false;
      } else {
        window['kaiadstimer'] = now;
      }
    }
    console.log('Display Ads:', display);
    if (!display)
      return;
    getKaiAd({
      publisher: 'ac3140f7-08d6-46d9-aa6f-d861720fba66',
      app: 'k-video-player',
      slot: 'kaios',
      onerror: err => console.error(err),
      onready: ad => {
        ad.call('display')
        ad.on('close', () => {
          app.$router.hideBottomSheet();
          document.body.style.position = '';
        });
        ad.on('display', () => {
          app.$router.hideBottomSheet();
          document.body.style.position = '';
        });
      }
    })
  }

  displayKaiAds();

  var EXIT_STACK = 0;
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Call') {
      if (window['exittimer'])
        clearTimeout(window['exittimer']);
      EXIT_STACK += 1;
      if (EXIT_STACK === 3)
        window.close();
      window['exittimer'] = setTimeout(() => {
        EXIT_STACK = 0;
        window['exittimer'] = null;
      }, 300);
    }
  });

  document.addEventListener('visibilitychange', function(ev) {
    if (document.visibilityState === 'visible') {
      displayKaiAds();
    }
  });

});