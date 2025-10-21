/**
 * Background Service Worker
 * Handles extension lifecycle events and background tasks
 */

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First time installation
    console.log('Thanks for installing Spotify Pitch Shifter!');
    
    // Set default settings
    chrome.storage.local.set({
      pitch: 0,
      speed: 1.0
    });

    // Optional: Open a welcome page
    // chrome.tabs.create({
    //   url: 'https://your-website.com/welcome'
    // });
  } else if (details.reason === 'update') {
    // Extension was updated
    const previousVersion = details.previousVersion;
    console.log(`Updated from version ${previousVersion}`);
    
    // Optional: Show changelog
    // chrome.tabs.create({
    //   url: 'https://your-website.com/changelog'
    // });
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);

  switch (request.action) {
    case 'logEvent':
      // Handle analytics or logging
      console.log('Event:', request.event, request.data);
      sendResponse({ success: true });
      break;

    case 'checkSpotifyTab':
      // Check if any tab has Spotify open
      chrome.tabs.query({ url: 'https://open.spotify.com/*' }, (tabs) => {
        sendResponse({ 
          hasSpotifyTab: tabs.length > 0,
          tabs: tabs.map(t => ({ id: t.id, url: t.url }))
        });
      });
      return true; // Keep channel open for async response

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Handle extension icon click (optional - if not using popup)
// chrome.action.onClicked.addListener((tab) => {
//   console.log('Extension icon clicked', tab);
// });

// Monitor tab updates to detect Spotify navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('open.spotify.com')) {
    console.log('Spotify tab loaded:', tabId);
    
    // Optional: Inject content script dynamically if needed
    // chrome.scripting.executeScript({
    //   target: { tabId },
    //   files: ['content/content.js']
    // });
  }
});

// Keep service worker alive (optional - for debugging)
// Service workers in Manifest V3 can go inactive, but will wake up for events
chrome.runtime.onSuspend.addListener(() => {
  console.log('Service worker going inactive');
});

console.log('🎵 Spotify Pitch Shifter - Background script loaded');