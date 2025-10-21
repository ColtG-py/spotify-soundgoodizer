/**
 * Injected Script - Runs in the page context (not content script context)
 * This intercepts Spotify's video element creation AND prevents playback rate resets
 */

(function() {
  console.log('🎵 Spotify Pitch Shifter - Inject script loaded');

  // Store references to all video/audio elements created by Spotify
  const mediaElements: HTMLMediaElement[] = [];
  
  // Current settings (will be updated by content script)
  let currentSpeed = 1.0;
  let currentPreservesPitch = true;
  
  // CRITICAL: Save the original playbackRate descriptor before Spotify can access it
  const playbackRateDescriptor = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype, 
    'playbackRate'
  );
  
  // Override the playbackRate setter to prevent Spotify from resetting it
  Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
    set(value: any) {
      // Ignore canvas video elements (ads, video content)
      if (this.parentElement?.className.toLowerCase().includes('canvas')) {
        playbackRateDescriptor!.set!.call(this, 1);
        return;
      }

      // If the value comes from our extension, allow it
      if (value && typeof value === 'object' && value.source === 'spotify-pitch-shifter') {
        playbackRateDescriptor!.set!.call(this, value.value);
      } else {
        // Otherwise, it's Spotify trying to reset - block it and use our speed
        console.log('🛡️ Blocked Spotify playback rate reset, maintaining:', currentSpeed);
        playbackRateDescriptor!.set!.call(this, currentSpeed);
      }
    },
    get() {
      return playbackRateDescriptor!.get!.call(this);
    }
  });
  
  // Save the original createElement function
  const originalCreateElement = document.createElement.bind(document);
  
  // Override document.createElement to intercept video/audio creation
  document.createElement = function(tagName: any, options?: any) {
    const element = originalCreateElement(tagName, options);
    
    // If Spotify creates a video or audio element, capture it
    if (tagName.toLowerCase() === 'video' || tagName.toLowerCase() === 'audio') {
      console.log(`✅ Intercepted ${tagName} element creation!`);
      
      const mediaEl = element as HTMLMediaElement;
      mediaElements.push(mediaEl);
      
      // Apply current settings immediately
      setTimeout(() => {
        mediaEl.playbackRate = { source: 'spotify-pitch-shifter', value: currentSpeed } as any;
        mediaEl.preservesPitch = currentPreservesPitch;
      }, 0);
      
      // Dispatch custom event to notify content script
      window.dispatchEvent(new CustomEvent('spotifyMediaElementCreated', {
        detail: { element, type: tagName }
      }));
    }
    
    return element;
  };
  
  // Expose functions to the page context for content script to call
  (window as any).__spotifyPitchShifter = {
    // Get the current active media element
    getMediaElement: function() {
      // Return the most recently created element that's actually playing
      for (let i = mediaElements.length - 1; i >= 0; i--) {
        const el = mediaElements[i];
        if (el && !el.paused && el.readyState >= 2) {
          return el;
        }
      }
      // Otherwise return the most recent one
      return mediaElements[mediaElements.length - 1] || null;
    },
    
    // Set speed on all media elements
    setSpeed: function(speed: number) {
      currentSpeed = speed;
      mediaElements.forEach((el) => {
        if (el) {
          el.playbackRate = { source: 'spotify-pitch-shifter', value: speed } as any;
        }
      });
      console.log(`🎵 Speed set to ${speed}x on ${mediaElements.length} elements`);
    },
    
    // Set preserves pitch on all media elements
    setPreservesPitch: function(preserve: boolean) {
      currentPreservesPitch = preserve;
      mediaElements.forEach((el) => {
        if (el) {
          el.preservesPitch = preserve;
        }
      });
      console.log(`🎵 Preserve pitch: ${preserve}`);
    },
    
    // Get current settings
    getSettings: function() {
      return {
        speed: currentSpeed,
        preservesPitch: currentPreservesPitch,
        elementCount: mediaElements.length
      };
    }
  };
  
  console.log('🔧 Spotify audio interception ready!');
})();