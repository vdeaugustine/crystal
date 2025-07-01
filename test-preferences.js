// Test script to verify preference handlers are working
// Run this in the Electron DevTools console

async function testPreferences() {
  console.log('Testing preference handlers...');
  
  try {
    // Test getting a preference
    console.log('Testing preferences:get...');
    const getResult = await window.electron.invoke('preferences:get', 'hide_welcome');
    console.log('Get result:', getResult);
    
    // Test setting a preference
    console.log('Testing preferences:set...');
    const setResult = await window.electron.invoke('preferences:set', 'test_key', 'test_value');
    console.log('Set result:', setResult);
    
    // Test getting the value we just set
    console.log('Testing preferences:get for test_key...');
    const getTestResult = await window.electron.invoke('preferences:get', 'test_key');
    console.log('Get test result:', getTestResult);
    
    // Test getting all preferences
    console.log('Testing preferences:get-all...');
    const getAllResult = await window.electron.invoke('preferences:get-all');
    console.log('Get all result:', getAllResult);
    
  } catch (error) {
    console.error('Error testing preferences:', error);
  }
}

// Run the test
testPreferences();