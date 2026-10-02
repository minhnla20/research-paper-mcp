import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MCPClient {
  constructor() {
    this.server = null;
    this.requestId = 1;
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log('🚀 Starting MCP Client...');
    console.log('Connecting to research-paper server...\n');
    
    // Start the MCP server
    this.server = spawn('node', [join(__dirname, 'dist/index.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle server output
    this.server.stdout.on('data', (data) => {
      try {
        const response = JSON.parse(data.toString().trim());
        this.handleResponse(response);
      } catch (e) {
        // Ignore non-JSON output
      }
    });

    this.server.stderr.on('data', (data) => {
      console.error('❌ Server error:', data.toString());
    });

    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Initialize connection
    await this.initialize();
    
    // Start chat interface
    this.startChat();
  }

  async initialize() {
    const initRequest = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: "mcp-test-client",
          version: "1.0.0"
        }
      }
    };

    this.sendRequest(initRequest);
  }

  async listTools() {
    const request = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "tools/list",
      params: {}
    };

    this.sendRequest(request);
  }

  async callTool(name, arguments_) {
    const request = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "tools/call",
      params: {
        name,
        arguments: arguments_
      }
    };

    this.sendRequest(request);
  }

  sendRequest(request) {
    if (this.server && this.server.stdin.writable) {
      this.server.stdin.write(JSON.stringify(request) + '\n');
    }
  }

  handleResponse(response) {
    if (response.error) {
      console.error('❌ Error:', response.error);
      return;
    }

    if (response.method === "notifications/tools/list_changed") {
      console.log('📢 Tools list changed');
      return;
    }

    if (response.result) {
      console.log('\n✅ Response:');
      
      if (response.result.tools) {
        console.log('📚 Available tools:');
        response.result.tools.forEach(tool => {
          console.log(`  • ${tool.name}: ${tool.description}`);
        });
      } else if (response.result.content) {
        response.result.content.forEach(content => {
          if (content.type === 'text') {
            console.log(content.text);
          } else if (content.type === 'json') {
            console.log(JSON.stringify(content.json, null, 2));
          }
        });
      } else {
        console.log(JSON.stringify(response.result, null, 2));
      }
    }

    console.log('\n💬 Enter a command (or "help" for options):');
  }

  startChat() {
    console.log('\n💬 MCP Client Ready! Type "help" for available commands.\n');
    
    this.rl.on('line', async (input) => {
      const command = input.trim().toLowerCase();
      
      if (command === 'quit' || command === 'exit') {
        console.log('👋 Goodbye!');
        this.cleanup();
        process.exit(0);
      }
      
      if (command === 'help') {
        this.showHelp();
        return;
      }
      
      if (command === 'tools') {
        await this.listTools();
        return;
      }
      
      if (command.startsWith('search ')) {
        const query = input.substring(7).trim();
        await this.callTool('search_papers', { query, filters: { maxResults: 5 } });
        return;
      }
      
      if (command.startsWith('summary ')) {
        const paperId = input.substring(8).trim();
        await this.callTool('generate_summary', { paperId, summaryType: 'brief' });
        return;
      }
      
      if (command.startsWith('export ')) {
        const parts = input.substring(7).trim().split(' ');
        const format = parts[0];
        const papers = parts.slice(1).map(id => ({ id, title: `Paper ${id}`, authors: ['Author'], year: 2024 }));
        await this.callTool('export_citations', { papers, format });
        return;
      }
      
      console.log('❓ Unknown command. Type "help" for available options.');
    });
  }

  showHelp() {
    console.log('\n📖 Available Commands:');
    console.log('  help                    - Show this help message');
    console.log('  tools                   - List available tools');
    console.log('  search <query>          - Search for papers (e.g., "search machine learning")');
    console.log('  summary <paperId>       - Generate summary for a paper (e.g., "summary arxiv:1234")');
    console.log('  export <format> <ids>   - Export citations (e.g., "export bibtex paper1 paper2")');
    console.log('  quit/exit               - Exit the client');
    console.log('');
  }

  cleanup() {
    if (this.server) {
      this.server.kill();
    }
    if (this.rl) {
      this.rl.close();
    }
  }
}

// Start the client
const client = new MCPClient();
client.start().catch(console.error);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  client.cleanup();
  process.exit(0);
});

