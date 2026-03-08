/**
 * Simple script to test iflow ACP startup
 */

const { spawn } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');

const IFLOW_PATH = 'C:\\Users\\蒙澄越\\AppData\\Roaming\\npm\\iflow.cmd';
const PORT = 8090;

console.log('='.repeat(60));
console.log('iFlow ACP Startup Test');
console.log('='.repeat(60));
console.log(`iflow path: ${IFLOW_PATH}`);
console.log(`Port: ${PORT}`);
console.log('');

let iflowProcess = null;
let connectionAttempts = 0;
const MAX_ATTEMPTS = 30;
let checkInterval = null;

// Cleanup on exit
function cleanup() {
  console.log('\nCleaning up...');
  if (checkInterval) clearInterval(checkInterval);
  
  if (iflowProcess && !iflowProcess.killed) {
    console.log('Terminating iflow process...');
    iflowProcess.kill();
  }
  
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start iflow process
console.log('Step 1: Starting iflow process...');
const args = ['--experimental-acp', '--port', String(PORT)];
console.log(`Command: ${IFLOW_PATH} ${args.join(' ')}`);

iflowProcess = spawn(IFLOW_PATH, args, {
  shell: true,
  windowsHide: true,
  stdio: ['pipe', 'pipe', 'pipe']
});

if (!iflowProcess.stdout || !iflowProcess.stderr) {
  console.error('ERROR: Failed to create process streams');
  process.exit(1);
}

// Capture output
iflowProcess.stdout.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    console.log(`[iflow stdout]: ${output}`);
  }
});

iflowProcess.stderr.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    console.error(`[iflow stderr]: ${output}`);
  }
});

iflowProcess.on('error', (error) => {
  console.error('Process error:', error);
  cleanup();
});

iflowProcess.on('exit', (code, signal) => {
  console.log(`iflow process exited with code ${code}, signal ${signal}`);
  cleanup();
});

// Wait a bit then try to connect
console.log('\nStep 2: Waiting for server to start...');
setTimeout(() => {
  console.log('Step 3: Attempting to connect to WebSocket...');
  tryConnect();
}, 2000);

function tryConnect() {
  const url = `ws://127.0.0.1:${PORT}/acp?peer=iflow`;
  console.log(`Attempt ${connectionAttempts + 1}/${MAX_ATTEMPTS}: Connecting to ${url}`);
  
  const ws = new WebSocket(url);
  
  ws.on('open', () => {
    console.log('✓ WebSocket connected successfully!');
    console.log('');
    console.log('Connection test PASSED!');
    console.log('');
    console.log('You can now close this script (Ctrl+C) and try the main application again.');
    console.log('Note: The iflow process will keep running in the background.');
    console.log('You may want to stop it manually before running the main app again.');
    cleanup();
  });
  
  ws.on('error', (error) => {
    console.log(`✗ Connection failed: ${error.message}`);
    connectionAttempts++;
    
    if (connectionAttempts < MAX_ATTEMPTS) {
      checkInterval = setTimeout(tryConnect, 1000);
    } else {
      console.log('');
      console.log('✗ Connection test FAILED!');
      console.log('Could not connect after', MAX_ATTEMPTS, 'attempts.');
      cleanup();
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: ${code} - ${reason}`);
  });
}