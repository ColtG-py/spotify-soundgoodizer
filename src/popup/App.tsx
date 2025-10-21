import React, { useState, useEffect, useRef } from 'react';
import './App.css';

interface Point {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  pinned: boolean;
}

function PhysicsCable({ sliderValue, min, max }: { sliderValue: number; min: number; max: number }) {
  const canvasRef = useRef<SVGSVGElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const animationRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Cable settings
  const segmentCount = 25;
  const gravity = 0.2;
  const friction = 0.9;

  useEffect(() => {
    // Initialize cable points
    if (pointsRef.current.length === 0) {
      const points: Point[] = [];
      for (let i = 0; i < segmentCount; i++) {
        points.push({
          x: 0,
          y: 0,
          oldX: 0,
          oldY: 0,
          pinned: i === 0 // First point is pinned
        });
      }
      pointsRef.current = points;
    }

    // Animation loop
    const animate = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const width = rect.width;

      // Calculate slider thumb position
      const normalizedValue = (sliderValue - min) / (max - min);
      const sliderX = normalizedValue * width;
      const sliderY = 38; // Approximate vertical position of slider

      const points = pointsRef.current;

      // Update physics
      for (let i = 0; i < points.length; i++) {
        const point = points[i];

        if (point.pinned) {
          // First point stays at left edge
          point.x = -10;
          point.y = sliderY;
          point.oldX = point.x;
          point.oldY = point.y;
          continue;
        }

        // Verlet integration
        const vx = (point.x - point.oldX) * friction;
        const vy = (point.y - point.oldY) * friction;

        point.oldX = point.x;
        point.oldY = point.y;

        point.x += vx;
        point.y += vy + gravity;

        // Last point follows slider thumb
        if (i === points.length - 1) {
          point.x = sliderX;
          point.y = sliderY;
        }
      }

      // Apply constraints (keep segments connected)
      const segmentLength = 8;
      for (let iter = 0; iter < 3; iter++) {
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const difference = segmentLength - distance;
          const percent = difference / distance / 2;

          const offsetX = dx * percent;
          const offsetY = dy * percent;

          if (!p1.pinned) {
            p1.x -= offsetX;
            p1.y -= offsetY;
          }
          if (!p2.pinned && i !== points.length - 2) {
            p2.x += offsetX;
            p2.y += offsetY;
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [sliderValue, min, max]);

  // Generate SVG path from points
  const generatePath = () => {
    const points = pointsRef.current;
    if (points.length === 0) return '';

    let path = `M ${points[0].x} ${points[0].y}`;
    
    // Smooth curve through points using quadratic bezier
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (i === 1) {
        path += ` L ${p.x} ${p.y}`;
      } else {
        const prev = points[i - 1];
        const cx = (prev.x + p.x) / 2;
        const cy = (prev.y + p.y) / 2;
        path += ` Q ${prev.x} ${prev.y} ${cx} ${cy}`;
      }
    }
    
    // Final point
    const last = points[points.length - 1];
    path += ` L ${last.x} ${last.y}`;

    return path;
  };

  return (
    <div ref={containerRef} className="cable-container">
      <svg ref={canvasRef}>
        <path
          d={generatePath()}
          fill="none"
          stroke="rgba(200, 200, 200, 0.8)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="drop-shadow(0 2px 3px rgba(0, 0, 0, 0.6))"
        />
        {/* Cable connector plug at slider end */}
        <circle
          cx={pointsRef.current[pointsRef.current.length - 1]?.x || 0}
          cy={pointsRef.current[pointsRef.current.length - 1]?.y || 0}
          r="4"
          fill="rgba(180, 180, 180, 0.9)"
          stroke="rgba(100, 100, 100, 0.8)"
          strokeWidth="1"
        />
        {/* Cable jack at left end */}
        <circle
          cx={pointsRef.current[0]?.x || 0}
          cy={pointsRef.current[0]?.y || 0}
          r="5"
          fill="rgba(150, 150, 150, 0.9)"
          stroke="rgba(80, 80, 80, 0.8)"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

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
      <h1>soundgoody</h1>
      
      <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
        {status}
      </div>

      <div className="controls">
        <div className="control-group">
          <label htmlFor="pitch">
            Pitch: <strong>{pitch > 0 ? `+${pitch}` : pitch}</strong> semitones
          </label>
          <input
            type="range"
            id="pitch"
            min="-12"
            max="12"
            value={pitch}
            onChange={handlePitchChange}
            disabled={!isConnected}
          />
          <div className="range-markers">
            <span>-12</span>
            <span>0</span>
            <span>+12</span>
          </div>
        </div>

        <div className="control-group">
          <PhysicsCable sliderValue={speed} min={0.5} max={2} />
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
          Reset All
        </button>
      </div>

    </div>
  );
}

export default App;