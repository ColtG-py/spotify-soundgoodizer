/**
 * Content Script - Runs in the context of the Spotify web player
 * Injects a script to intercept Spotify's video element creation
 */

class SpotifyAudioManipulator {
  private currentPitch: number = 0;
  private currentSpeed: number = 1.0;
  private mediaElement: HTMLMediaElement | null = null;

  constructor() {
    // Inject our script into the page context ASAP
    this.injectScript();
    
    // Listen for when Spotify creates media elements
    window.addEventListener('spotifyMediaElementCreated', ((e: CustomEvent) => {
      console.log('📺 Spotify created a media element:', e.detail.type);
      this.mediaElement = e.detail.element;
    }) as EventListener);
  }

  /**
   * Inject script into page context to intercept createElement
   */
  private injectScript(): void {
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        console.log('🎵 Spotify Pitch Shifter - Inject script loaded');

        const mediaElements = [];
        const originalCreateElement = document.createElement.bind(document);
        
        document.createElement = function(tagName, options) {
          const element = originalCreateElement(tagName, options);
          
          if (tagName.toLowerCase() === 'video' || tagName.toLowerCase() === 'audio') {
            console.log('✅ Intercepted ' + tagName + ' element creation!');
            mediaElements.push(element);
            window.__spotifyMediaElements = mediaElements;
            
            window.dispatchEvent(new CustomEvent('spotifyMediaElementCreated', {
              detail: { element, type: tagName }
            }));
          }
          
          return element;
        };
        
        window.getSpotifyMediaElement = function() {
          for (let i = mediaElements.length - 1; i >= 0; i--) {
            const el = mediaElements[i];
            if (el && !el.paused && el.readyState >= 2) {
              return el;
            }
          }
          return mediaElements[mediaElements.length - 1] || null;
        };
        
        console.log('🔧 document.createElement has been intercepted');
      })();
    `;
    
    // Inject at the start of <head> or <html> to run before Spotify's scripts
    (document.head || document.documentElement).prepend(script);
    console.log('💉 Injected interception script');
  }

  /**
   * Initialize - Get reference to media element
   */
  async init(): Promise<boolean> {
    console.log('🔍 Initializing...');
    
    // Try to get existing media element
    this.mediaElement = this.getMediaElement();
    
    if (this.mediaElement) {
      console.log('✅ Found existing media element');
      return true;
    }
    
    // Wait for Spotify to create the media element
    console.log('⏳ Waiting for Spotify to create media element...');
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 40; // 20 seconds
      
      const checkInterval = setInterval(() => {
        this.mediaElement = this.getMediaElement();
        
        if (this.mediaElement) {
          console.log(`✅ Media element found after ${attempts * 0.5}s`);
          clearInterval(checkInterval);
          resolve(true);
          return;
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          console.error('❌ Timeout: No media element found');
          console.log('💡 Try playing a song, then refresh and try again');
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 500);
    });
  }

  /**
   * Get media element from page context
   */
  private getMediaElement(): HTMLMediaElement | null {
    try {
      // Call the function we injected into page context
      const element = (window as any).getSpotifyMediaElement?.();
      return element || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Set pitch shift in semitones
   */
  setPitch(semitones: number): void {
    this.currentPitch = semitones;
    const pitchRatio = Math.pow(2, semitones / 12);
    console.log(`🎵 Pitch set to ${semitones} semitones (ratio: ${pitchRatio.toFixed(3)})`);
    
    // TODO: Implement actual pitch shifting with a library
    // For now, this is just logged
  }

  /**
   * Set playback speed
   */
  setSpeed(speed: number): void {
    this.currentSpeed = speed;
    
    // Get fresh reference in case it changed
    const element = this.getMediaElement();
    
    if (element) {
      try {
        element.playbackRate = speed;
        console.log(`✅ Speed set to ${speed.toFixed(2)}x`);
      } catch (error) {
        console.error('❌ Failed to set playback rate:', error);
      }
    } else {
      console.error('❌ No media element available');
    }
  }

  /**
   * Get current settings
   */
  getSettings(): { pitch: number; speed: number } {
    return {
      pitch: this.currentPitch,
      speed: this.currentSpeed
    };
  }
}

// Create singleton instance
const manipulator = new SpotifyAudioManipulator();

/**
 * Listen for messages from the popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received:', request.action);

  switch (request.action) {
    case 'init':
      manipulator.init().then(success => {
        sendResponse({ success });
      });
      return true; // Keep channel open for async
    
    case 'setPitch':
      manipulator.setPitch(request.value);
      sendResponse({ success: true });
      break;
    
    case 'setSpeed':
      manipulator.setSpeed(request.value);
      sendResponse({ success: true });
      break;
    
    case 'getSettings':
      sendResponse({ 
        success: true, 
        settings: manipulator.getSettings() 
      });
      break;
    
    default:
      console.warn('⚠️ Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

console.log('🎵 Spotify Pitch Shifter - Content script loaded');