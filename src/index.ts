import { IncomingMessage, ServerResponse } from 'http';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
}

interface MCPServerInfo {
  name: string;
  version: string;
  capabilities: MCPServerCapabilities;
}

class AtlasMCPServer {
  private serverInfo: MCPServerInfo;
  private clients: Map<string, ServerResponse>;
  private atlasEndpoint: string;

  constructor() {
    this.serverInfo = {
      name: 'atlas-mcp-server',
      version: '1.0.0',
      capabilities: {
        tools: { listChanged: true },
        prompts: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
      },
    };
    this.clients = new Map();
    this.atlasEndpoint = process.env.ATLAS_ENDPOINT || 'http://100.64.0.1:8080';
  }

  private log(level: 'info' | 'error' | 'warn', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${logData}`);
  }

  private sendSSE(res: ServerResponse, event: string, data: any) {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      this.log('error', 'Failed to send SSE', { error: (error as Error).message });
    }
  }

  private createJsonRpcResponse(
    id: string | number | null,
    result?: any,
    error?: { code: number; message: string; data?: any }
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      ...(error ? { error } : { result }),
    };
  }

  private async handleInitialize(params: any): Promise<any> {
    this.log('info', 'Client initializing', { params });
    return {
      protocolVersion: '2024-11-05',
      serverInfo: this.serverInfo,
      capabilities: this.serverInfo.capabilities,
    };
  }

  private async handleListTools(): Promise<any> {
    return {
      tools: [
        {
          name: 'atlas_query',
          description: 'Query the Atlas Monolith Agent via Tailscale network',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The query to send to Atlas',
              },
              context: {
                type: 'object',
                description: 'Optional context for the query',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'atlas_execute',
          description: 'Execute a command on the Atlas Monolith Agent',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The command to execute',
              },
              args: {
                type: 'array',
                items: { type: 'string' },
                description: 'Command arguments',
              },
            },
            required: ['command'],
          },
        },
        {
          name: 'atlas_status',
          description: 'Get the current status of the Atlas Monolith Agent',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
  }

  private async handleCallTool(params: { name: string; arguments?: any }): Promise<any> {
    this.log('info', 'Tool called', { name: params.name });

    try {
      switch (params.name) {
        case 'atlas_query':
          return await this.callAtlasQuery(params.arguments);
        case 'atlas_execute':
          return await this.callAtlasExecute(params.arguments);
        case 'atlas_status':
          return await this.callAtlasStatus();
        default:
          throw new Error(`Unknown tool: ${params.name}`);
      }
    } catch (error) {
      this.log('error', 'Tool execution failed', {
        tool: params.name,
        error: (error as Error).message,
      });
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async callAtlasQuery(args: { query: string; context?: any }): Promise<any> {
    this.log('info', 'Calling Atlas query', { query: args.query });

    try {
      const response = await fetch(`${this.atlasEndpoint}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ATLAS_API_KEY || ''}`,
        },
        body: JSON.stringify({
          query: args.query,
          context: args.context,
        }),
      });

      if (!response.ok) {
        throw new Error(`Atlas API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to query Atlas: ${(error as Error).message}`);
    }
  }

  private async callAtlasExecute(args: { command: string; args?: string[] }): Promise<any> {
    this.log('info', 'Calling Atlas execute', { command: args.command });

    try {
      const response = await fetch(`${this.atlasEndpoint}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ATLAS_API_KEY || ''}`,
        },
        body: JSON.stringify({
          command: args.command,
          args: args.args || [],
        }),
      });

      if (!response.ok) {
        throw new Error(`Atlas API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to execute on Atlas: ${(error as Error).message}`);
    }
  }

  private async callAtlasStatus(): Promise<any> {
    this.log('info', 'Calling Atlas status');

    try {
      const response = await fetch(`${this.atlasEndpoint}/api/status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.ATLAS_API_KEY || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Atlas API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get Atlas status: ${(error as Error).message}`);
    }
  }

  private async handleJsonRpcRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { id, method, params } = request;

    try {
      let result: any;

      switch (method) {
        case 'initialize':
          result = await this.handleInitialize(params);
          break;
        case 'tools/list':
          result = await this.handleListTools();
          break;
        case 'tools/call':
          result = await this.handleCallTool(params);
          break;
        case 'ping':
          result = {};
          break;
        default:
          return this.createJsonRpcResponse(id || null, undefined, {
            code: -32601,
            message: `Method not found: ${method}`,
          });
      }

      return this.createJsonRpcResponse(id || null, result);
    } catch (error) {
      this.log('error', 'JSON-RPC error', {
        method,
        error: (error as Error).message,
      });
      return this.createJsonRpcResponse(id || null, undefined, {
        code: -32603,
        message: 'Internal error',
        data: (error as Error).message,
      });
    }
  }

  public handleRoot(req: IncomingMessage, res: ServerResponse) {
    this.log('info', 'Root endpoint accessed');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify(
        {
          name: this.serverInfo.name,
          version: this.serverInfo.version,
          protocol: 'MCP',
          transport: 'SSE',
          endpoints: {
            sse: '/mcp',
          },
          description: 'MCP server for Atlas Monolith Agent integration',
        },
        null,
        2
      )
    );
  }

  public handleSSE(req: IncomingMessage, res: ServerResponse) {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.log('info', 'SSE connection established', { clientId });

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Store client
    this.clients.set(clientId, res);

    // Send initial connection event
    this.sendSSE(res, 'open', { clientId });

    // Handle incoming messages
    let buffer = '';
    req.on('data', async (chunk) => {
      buffer += chunk.toString();

      // Process complete JSON-RPC messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const request: JsonRpcRequest = JSON.parse(line);
            this.log('info', 'Received JSON-RPC request', {
              method: request.method,
              id: request.id,
            });

            const response = await this.handleJsonRpcRequest(request);
            this.sendSSE(res, 'message', response);
          } catch (error) {
            this.log('error', 'Failed to parse JSON-RPC request', {
              error: (error as Error).message,
            });
            const errorResponse = this.createJsonRpcResponse(null, undefined, {
              code: -32700,
              message: 'Parse error',
            });
            this.sendSSE(res, 'message', errorResponse);
          }
        }
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      this.log('info', 'SSE connection closed', { clientId });
      this.clients.delete(clientId);
    });

    // Keep-alive ping
    const pingInterval = setInterval(() => {
      if (!this.clients.has(clientId)) {
        clearInterval(pingInterval);
        return;
      }
      this.sendSSE(res, 'ping', {});
    }, 30000);
  }
}

// Vercel serverless function handler
const server = new AtlasMCPServer();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/' || url.pathname === '') {
    server.handleRoot(req, res);
  } else if (url.pathname === '/mcp') {
    server.handleSSE(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}
