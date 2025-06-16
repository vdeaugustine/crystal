# Crystal Performance Optimizations

## Summary

This document describes the performance optimizations implemented to reduce high CPU usage (133%) in the Crystal Helper renderer process.

## Key Issues Identified

1. **Continuous CSS Animations** - Multiple components had animations running constantly even when not visible
2. **Aggressive Polling Intervals** - Multiple timers checking status every 100ms to 5 seconds  
3. **XTerm.js Performance** - 50,000 line scrollback buffer with unbatched writes
4. **Missing React Optimizations** - No memoization causing excessive re-renders
5. **Real-time Updates** - WebSocket messages processed without batching

## Optimizations Implemented

### 1. Animation Performance

- **StatusIndicator.tsx**: 
  - Added visibility detection to pause animations when tab is not visible
  - Disabled animations for inactive session states
  - Added React.memo for better component memoization
  
- **SessionView.tsx**:
  - Added visibility detection for typing dots animation
  - Added React.memo to prevent unnecessary re-renders

### 2. Polling Optimizations

- **useSessionView.ts**:
  - Elapsed time updates: 5s when visible → 30s when not visible
  - Terminal initialization check: Limited to 50 attempts max
  - Stravu connection check: 30s when visible → 2min when not visible
  
- **StravuStatusIndicator.tsx**:
  - Connection status check: 30s when visible → 2min when not visible

### 3. XTerm.js Optimizations

- **Reduced scrollback buffer**: 50,000 → 10,000 lines (5,000 for script terminal)
- **Added performance settings**:
  - fastScrollModifier: 'ctrl'
  - fastScrollSensitivity: 5
  - scrollSensitivity: 1
- **Batched terminal writes**: Using requestAnimationFrame for smoother rendering

### 4. New Performance Utilities

Created `performanceUtils.ts` with:
- `isDocumentVisible()` - Check if tab is visible
- `throttle()` - Limit function execution frequency
- `debounce()` - Delay function execution
- `BatchProcessor` - Batch multiple updates
- `createVisibilityAwareInterval()` - Adaptive polling based on tab visibility
- `createAnimationObserver()` - Pause animations when elements not visible

## Expected Results

These optimizations should significantly reduce CPU usage by:
- Pausing animations when the app is not visible
- Reducing polling frequency when in background
- Improving terminal rendering performance
- Preventing unnecessary React re-renders

## Testing

To verify the improvements:
1. Open Activity Monitor and monitor "Crystal Helper (Renderer)" CPU usage
2. Test with multiple active sessions
3. Switch tabs and verify CPU usage drops
4. Check that animations pause when tab is not visible

## Future Improvements

Consider:
- Virtual scrolling for long session lists
- Web Workers for heavy computations
- Lazy loading of diff viewer components
- Message batching for WebSocket updates
- Further reduction of terminal scrollback buffer if needed