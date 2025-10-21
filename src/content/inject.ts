/**
 * Injected Script - Runs in the page context (not content script context)
 * This intercepts Spotify's video element creation
 */

(function() {
  console.log('🎵 Spotify Pitch Shifter - Inject script loaded');

  // Store references to all video/audio elements created by Spotify
  const mediaElements: HTMLMediaElement[] = [];
  
  // Save the original createElement function
  const originalCreateElement = document.createElement.bind(document);
  
  // Override document.createElement to intercept video/audio creation
  document.createElement = function(tagName: any, options?: any) {
    const element = originalCreateElement(tagName, options);
    
    // If Spotify creates a video or audio element, capture it
    if (tagName.toLowerCase() === 'video' || tagName.toLowerCase() === 'audio') {
      console.log(`✅ Intercepted ${tagName} element creation!`);
      mediaElements.push(element as HTMLMediaElement);
      
      // Make it globally accessible
      (window as any).__spotifyMediaElements = mediaElements;
      
      // Dispatch custom event to notify content script
      window.dispatchEvent(new CustomEvent('spotifyMediaElementCreated', {
        detail: { element, type: tagName }
      }));
    }
    
    return element;
  };
  
  // Also expose a helper function to get the current media element
  (window as any).getSpotifyMediaElement = function() {
    // Return the most recently created element that's actually playing
    for (let i = mediaElements.length - 1; i >= 0; i--) {
      const el = mediaElements[i];
      if (el && !el.paused && el.readyState >= 2) {
        return el;
      }
    }
    // Otherwise return the most recent one
    return mediaElements[mediaElements.length - 1] || null;
  };
  
  console.log('🔧 document.createElement has been intercepted');
})();