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

  } else if (details.reason === 'update') {
    // Extension was updated
    const previousVersion = details.previousVersion;
    console.log(`Updated from version ${previousVersion}`);

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


// Monitor tab updates to detect Spotify navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('open.spotify.com')) {
    console.log('Spotify tab loaded:', tabId);
  }
});

chrome.runtime.onSuspend.addListener(() => {
  console.log('Service worker going inactive');
});

console.log('🎵 Spotify Pitch Shifter - Background script loaded');