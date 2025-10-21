/**
 * Content Script - Runs in ISOLATED world (content script context)
 * Injects inject.js from web_accessible_resources into page context
 */

class SpotifyAudioManipulator {
  private currentPitch: number = 0;
  private currentSpeed: number = 1.0;
  private currentPreservesPitch: boolean = true;

  constructor() {
    console.log('🎵 SpotifyAudioManipulator initialized (content script)');
    
    // Inject the page context script immediately
    this.injectPageScript();
  }

  /**
   * Inject the page context script from web_accessible_resources
   */
  private injectPageScript(): void {
    const script = document.createElement('script');
    
    // Load the script from web_accessible_resources
    // The build system should output inject.js to the correct location
    script.src = chrome.runtime.getURL('src/content/inject.js');
    script.type = 'text/javascript';
    
    // Inject at the very start of <head> to run before Spotify's scripts
    const target = document.head || document.documentElement;
    target.insertBefore(script, target.firstChild);
    
    console.log('💉 Injected page script from:', script.src);
    
    // Remove script tag after injection to clean up DOM
    script.onload = () => {
      script.remove();
      console.log('🧹 Script tag removed after load');
    };
  }

  /**
   * Check if the page context script is ready
   */
  private isPageScriptReady(): boolean {
    return typeof (window as any).__spotifyPitchShifter !== 'undefined';
  }

  /**
   * Initialize - Wait for page script to be ready
   */
  async init(): Promise<boolean> {
    console.log('🔍 Initializing...');
    
    // Wait for page script to be ready (inject.ts running in MAIN world)
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds
    
    while (!this.isPageScriptReady() && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!this.isPageScriptReady()) {
      console.error('❌ Page script (__spotifyPitchShifter) not found');
      console.error('💡 Make sure inject.ts is loaded with world: MAIN in manifest');
      return false;
    }
    
    console.log('✅ Page script ready');
    
    // Check if Spotify has already created media elements
    const mediaElement = (window as any).__spotifyPitchShifter.getMediaElement();
    
    if (mediaElement) {
      console.log('✅ Media element found immediately');
      return true;
    }
    
    // Wait for Spotify to create media elements
    console.log('⏳ Waiting for Spotify to create media elements...');
    const found = await this.waitForMediaElement();
    
    if (found) {
      console.log('✅ Ready to control playback');
      return true;
    }
    
    console.error('❌ No media element found');
    console.log('💡 Try playing a song first');
    return false;
  }

  /**
   * Wait for Spotify to create a media element
   */
  private async waitForMediaElement(): Promise<boolean> {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 40; // 20 seconds
      
      const checkInterval = setInterval(() => {
        try {
          const element = (window as any).__spotifyPitchShifter?.getMediaElement();
          
          if (element) {
            console.log(`✅ Media element found after ${(attempts * 0.5).toFixed(1)}s`);
            clearInterval(checkInterval);
            resolve(true);
            return;
          }
        } catch (error) {
          console.error('Error checking for media element:', error);
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          console.error('❌ Timeout: No media element found after 20s');
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 500);
    });
  }

  /**
   * Set pitch shift in semitones (for future implementation)
   */
  setPitch(semitones: number): void {
    this.currentPitch = semitones;
    
    // Pitch shifting requires Web Audio API processing
    // This would need additional implementation with a pitch shift library
    console.log(`🎵 Pitch set to ${semitones} semitones (not yet implemented)`);
    console.log('💡 For pitch shifting, you would need to route audio through Web Audio API');
    
    // For now, we can adjust preserve pitch based on whether we're shifting
    if (semitones !== 0) {
      // When pitch shifting is desired but not implemented, 
      // disable preserve pitch to at least change the tone
      this.setPreservesPitch(false);
    } else {
      this.setPreservesPitch(true);
    }
  }

  /**
   * Set playback speed
   */
  setSpeed(speed: number): void {
    this.currentSpeed = speed;
    
    try {
      if (this.isPageScriptReady()) {
        (window as any).__spotifyPitchShifter.setSpeed(speed);
        console.log(`✅ Speed set to ${speed.toFixed(2)}x`);
      } else {
        console.error('❌ Page script not ready');
      }
    } catch (error) {
      console.error('❌ Failed to set speed:', error);
    }
  }

  /**
   * Set preserves pitch
   */
  setPreservesPitch(preserve: boolean): void {
    this.currentPreservesPitch = preserve;
    
    try {
      if (this.isPageScriptReady()) {
        (window as any).__spotifyPitchShifter.setPreservesPitch(preserve);
        console.log(`✅ Preserve pitch: ${preserve}`);
      }
    } catch (error) {
      console.error('❌ Failed to set preserves pitch:', error);
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