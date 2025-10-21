import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [pitch, setPitch] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    // Wait a bit for content script to fully load
    const timer = setTimeout(() => {
      initializeExtension();
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  const initializeExtension = async () => {
    try {
      const [tab] = await chrome.tabs.query({ 
        active: true, 
        currentWindow: true 
      });

      if (!tab.url?.includes('open.spotify.com')) {
        setStatus('⚠️ Please navigate to open.spotify.com');
        setIsConnected(false);
        return;
      }

      setStatus('Connecting to Spotify...');

      // Try to initialize with retries
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id!, { 
            action: 'init' 
          });

          if (response?.success) {
            setIsConnected(true);
            setStatus('✓ Connected to Spotify');
            
            // Load saved settings
            const saved = await chrome.storage.local.get(['pitch', 'speed']);
            if (saved.pitch !== undefined) {
              setPitch(saved.pitch);
              sendMessage('setPitch', saved.pitch);
            }
            if (saved.speed !== undefined) {
              setSpeed(saved.speed);
              sendMessage('setSpeed', saved.speed);
            }
            
            return; // Success!
          }
        } catch (error) {
          console.log(`Attempt ${attempts + 1} failed:`, error);
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // All attempts failed
      setStatus('✗ Could not connect. Make sure a song is playing.');
      setIsConnected(false);
      
    } catch (error) {
      setStatus('✗ Failed to connect. Try refreshing Spotify.');
      setIsConnected(false);
      console.error('Initialization error:', error);
    }
  };

  const sendMessage = async (action: string, value: number) => {
    try {
      const [tab] = await chrome.tabs.query({ 
        active: true, 
        currentWindow: true 
      });
      
      if (!tab.id) return;

      await chrome.tabs.sendMessage(tab.id, { action, value });
      
      // Save to storage
      if (action === 'setPitch') {
        await chrome.storage.local.set({ pitch: value });
      } else if (action === 'setSpeed') {
        await chrome.storage.local.set({ speed: value });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setStatus('✗ Connection lost. Refresh Spotify.');
      setIsConnected(false);
    }
  };

  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setPitch(value);
    sendMessage('setPitch', value);
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setSpeed(value);
    sendMessage('setSpeed', value);
  };

  const handleReset = () => {
    setPitch(0);
    setSpeed(1.0);
    sendMessage('setPitch', 0);
    sendMessage('setSpeed', 1.0);
  };

  return (
    <div className="container">
      <h1>soundgoodizer</h1>
      
      <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
        {status}
      </div>

      <div className="controls">
        <div className="control-group">
          <label htmlFor="speed">
            Speed: <strong>{speed.toFixed(2)}x</strong>
          </label>
          <input
            type="range"
            id="speed"
            min="0.5"
            max="2"
            step="0.05"
            value={speed}
            onChange={handleSpeedChange}
            disabled={!isConnected}
          />
          <div className="range-markers">
            <span>0.5x</span>
            <span>1.0x</span>
            <span>2.0x</span>
          </div>
        </div>

        <button 
          onClick={handleReset} 
          disabled={!isConnected}
          className="reset-button"
        >
          reset
        </button>
      </div>
    </div>
  );
}

export default App;