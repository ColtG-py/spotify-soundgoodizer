/**
 * Content Script - Runs in ISOLATED world (content script context)
 * Injects inject.js from web_accessible_resources into page context
 * Communicates with page context via DOM manipulation
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
    
    // Load inject.js from the root of the extension
    script.src = chrome.runtime.getURL('inject.js');
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
   * Send a command to the page context via CustomEvent
   * Returns a promise that resolves with the response
   */
  private async sendPageCommand(command: string, value?: any): Promise<any> {
    return new Promise((resolve) => {
      // Set up one-time listener for response
      const responseHandler = (event: Event) => {
        const customEvent = event as CustomEvent;
        document.removeEventListener('spotify-pitch-shifter-response', responseHandler);
        resolve(customEvent.detail);
      };
      
      document.addEventListener('spotify-pitch-shifter-response', responseHandler);
      
      // Dispatch command
      document.dispatchEvent(new CustomEvent('spotify-pitch-shifter-command', {
        detail: { command, value }
      }));
      
      // Timeout after 1 second
      setTimeout(() => {
        document.removeEventListener('spotify-pitch-shifter-response', responseHandler);
        resolve(null);
      }, 1000);
    });
  }

  /**
   * Check if the page context script is ready
   */
  private async isPageScriptReady(): Promise<boolean> {
    try {
      const response = await this.sendPageCommand('checkReady');
      return response && response.ready === true;
    } catch (error) {
      console.error('Error checking page script:', error);
      return false;
    }
  }

  /**
   * Initialize - Wait for page script to be ready
   */
  async init(): Promise<boolean> {
    console.log('Initializing...');
    
    // Wait for page script to be ready (inject.js running in page world)
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds
    
    while (attempts < maxAttempts) {
      const isReady = await this.isPageScriptReady();
      if (isReady) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    const finalCheck = await this.isPageScriptReady();
    if (!finalCheck) {
      console.error('Page script (__spotifyPitchShifter) not found');
      console.error('Make sure inject.js loaded successfully');
      return false;
    }
    
    console.log('✅ Page script ready');
    
    // Check if Spotify has already created media elements
    const response = await this.sendPageCommand('checkMediaElement');
    
    if (response && response.hasMediaElement) {
      console.log('Media element found immediately');
      return true;
    }
    
    // Wait for Spotify to create media elements
    console.log('Waiting for Spotify to create media elements...');
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
    let attempts = 0;
    const maxAttempts = 40; // 20 seconds
    
    while (attempts < maxAttempts) {
      const response = await this.sendPageCommand('checkMediaElement');
      
      if (response && response.hasMediaElement) {
        console.log(`✅ Media element found after ${(attempts * 0.5).toFixed(1)}s`);
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    console.error('❌ Timeout: No media element found after 20s');
    return false;
  }

  /**
   * Set pitch shift in semitones (for future implementation)
   */
  async setPitch(semitones: number): Promise<void> {
    this.currentPitch = semitones;
    
    // Pitch shifting requires Web Audio API processing
    // This would need additional implementation with a pitch shift library
    console.log(`Pitch set to ${semitones} semitones (not yet implemented)`);
    console.log('For pitch shifting, we need to route audio through Web Audio API');
    
    // For now, we can adjust preserve pitch based on whether we're shifting
    if (semitones !== 0) {
      // When pitch shifting is desired but not implemented, 
      // disable preserve pitch to at least change the tone
      await this.setPreservesPitch(false);
    } else {
      await this.setPreservesPitch(true);
    }
  }

  /**
   * Set playback speed
   */
  async setSpeed(speed: number): Promise<void> {
    this.currentSpeed = speed;
    
    try {
      await this.sendPageCommand('setSpeed', speed);
      console.log(`✅ Speed set to ${speed.toFixed(2)}x`);
    } catch (error) {
      console.error('❌ Failed to set speed:', error);
    }
  }

  /**
   * Set preserves pitch
   */
  async setPreservesPitch(preserve: boolean): Promise<void> {
    this.currentPreservesPitch = preserve;
    
    try {
      await this.sendPageCommand('setPreservesPitch', preserve);
      console.log(`✅ Preserve pitch: ${preserve}`);
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

console.log('Spotify Pitch Shifter - Content script loaded');