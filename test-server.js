import { spawn } from 'child_process';
import { readFileSync } from 'fs';

// Test the MCP server by sending a tools/list request
async function testServer() {
  console.log('Starting MCP server test...');
  
  const server = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Send tools/list request
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  };

  server.stdin.write(JSON.stringify(request) + '\n');
  
  server.stdout.on('data', (data) => {
    try {
      const response = JSON.parse(data.toString());
      console.log('✅ Server response:', JSON.stringify(response, null, 2));
      
      if (response.result && response.result.tools) {
        console.log(`\n🎉 Server is working! Found ${response.result.tools.length} tools:`);
        response.result.tools.forEach(tool => {
          console.log(`  - ${tool.name}: ${tool.description}`);
        });
      }
      
      server.kill();
    } catch (e) {
      console.log('Raw output:', data.toString());
    }
  });

  server.stderr.on('data', (data) => {
    console.error('Server error:', data.toString());
  });

  server.on('close', (code) => {
    console.log(`\nServer process exited with code ${code}`);
  });

  // Timeout after 5 seconds
  setTimeout(() => {
    console.log('⏰ Test timeout - killing server');
    server.kill();
  }, 5000);
}

testServer().catch(console.error);

