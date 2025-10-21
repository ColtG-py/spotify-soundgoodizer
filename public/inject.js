(function() {
  'use strict';
  
  // Store references to all video/audio elements created by Spotify
  var spotifyPlaybackEls = [];

  // Current settings (will be updated by content script)
  var currentSpeed = 1.0;
  var currentPreservesPitch = true;

  // CRITICAL: Save the original playbackRate descriptor before Spotify can access it
  var playbackRateDescriptor = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype, 
    'playbackRate'
  );

  if (!playbackRateDescriptor) {
    console.error('Could not get playbackRate descriptor');
  } else {
    // Override the playbackRate setter to prevent Spotify from resetting it
    Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
      set: function(value) {
        // Ignore canvas video elements (ads, video content)
        if (this.parentElement && this.parentElement.className.toLowerCase().includes('canvas')) {
          playbackRateDescriptor.set.call(this, 1);
          return;
        }

        // If the value comes from our extension, allow it
        if (value && typeof value === 'object' && value.source === 'spotify-pitch-shifter') {
          playbackRateDescriptor.set.call(this, value.value);
        } else {
          // Otherwise, it's Spotify trying to reset - block it and use our speed
          console.log('Blocked Spotify playback rate reset, maintaining:', currentSpeed);
          playbackRateDescriptor.set.call(this, currentSpeed);
        }
      },
      get: function() {
        return playbackRateDescriptor.get.call(this);
      },
      configurable: true
    });

    console.log('playbackRate setter overridden');
  }

  // Save the original createElement function
  var originalCreateElement = document.createElement.bind(document);

  // Override document.createElement to intercept video/audio creation
  document.createElement = function(tagName, options) {
    var element = originalCreateElement(tagName, options);
    
    // If Spotify creates a video or audio element, capture it
    if (tagName.toLowerCase() === 'video' || tagName.toLowerCase() === 'audio') {
      
      spotifyPlaybackEls.push(element);
      
      // Apply current settings immediately
      setTimeout(function() {
        element.playbackRate = { source: 'spotify-pitch-shifter', value: currentSpeed };
        element.preservesPitch = currentPreservesPitch;
        console.log('Applied settings to ' + tagName + ': speed=' + currentSpeed + ', preservesPitch=' + currentPreservesPitch);
      }, 0);
      
      // Dispatch custom event to notify content script
      window.dispatchEvent(new CustomEvent('spotifyMediaElementCreated', {
        detail: { element: element, type: tagName }
      }));
    }
    
    return element;
  };

  console.log('✅ document.createElement overridden');

  // Expose functions to window for content script to call
  window.__spotifyPitchShifter = {
    // Get the current active media element
    getMediaElement: function() {
      // Return the most recently created element that's actually playing
      for (var i = spotifyPlaybackEls.length - 1; i >= 0; i--) {
        var el = spotifyPlaybackEls[i];
        if (el && !el.paused && el.readyState >= 2) {
          return el;
        }
      }
      // Otherwise return the most recent one, or search the DOM as fallback
      if (spotifyPlaybackEls.length > 0) {
        return spotifyPlaybackEls[spotifyPlaybackEls.length - 1];
      }
      
      // Last resort: search DOM for audio/video elements
      var mediaEls = document.querySelectorAll('audio, video');
      return mediaEls.length > 0 ? mediaEls[mediaEls.length - 1] : null;
    },
    
    // Set speed on all media elements
    setSpeed: function(speed) {
      currentSpeed = speed;
      spotifyPlaybackEls.forEach(function(el) {
        if (el) {
          el.playbackRate = { source: 'spotify-pitch-shifter', value: speed };
        }
      });
      console.log('Speed set to ' + speed + 'x on ' + spotifyPlaybackEls.length + ' elements');
    },
    
    // Set preserves pitch on all media elements
    setPreservesPitch: function(preserve) {
      currentPreservesPitch = preserve;
      spotifyPlaybackEls.forEach(function(el) {
        if (el) {
          el.preservesPitch = preserve;
        }
      });
      console.log('Preserve pitch: ' + preserve);
    },
    
    // Get current settings
    getSettings: function() {
      return {
        speed: currentSpeed,
        preservesPitch: currentPreservesPitch,
        elementCount: spotifyPlaybackEls.length
      };
    }
  };

  // Listen for commands from content script via CustomEvents
  document.addEventListener('spotify-pitch-shifter-command', function(event) {
    var detail = event.detail;
    var command = detail.command;
    
    if (command === 'checkReady') {
      // Respond that we're ready
      document.dispatchEvent(new CustomEvent('spotify-pitch-shifter-response', {
        detail: { ready: true }
      }));
    } else if (command === 'checkMediaElement') {
      var el = window.__spotifyPitchShifter.getMediaElement();
      document.dispatchEvent(new CustomEvent('spotify-pitch-shifter-response', {
        detail: { hasMediaElement: !!el }
      }));
    } else if (command === 'setSpeed') {
      window.__spotifyPitchShifter.setSpeed(detail.value);
      document.dispatchEvent(new CustomEvent('spotify-pitch-shifter-response', {
        detail: { success: true }
      }));
    } else if (command === 'setPreservesPitch') {
      window.__spotifyPitchShifter.setPreservesPitch(detail.value);
      document.dispatchEvent(new CustomEvent('spotify-pitch-shifter-response', {
        detail: { success: true }
      }));
    }
  });

})();