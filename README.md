# Atlas MCP Server

A production-ready [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that enables seamless integration with Atlas Monolith Agent via Tailscale network. Built with Server-Sent Events (SSE) transport and deployable to Vercel with zero configuration.

## Features

- ✅ **MCP Protocol Compliance**: Full JSON-RPC 2.0 implementation with proper capability negotiation
- ✅ **SSE Transport**: Server-Sent Events for real-time bidirectional communication
- ✅ **Atlas Integration**: Direct connection to Atlas Monolith Agent via Tailscale
- ✅ **Vercel Ready**: One-command deployment with minimal configuration
- ✅ **TypeScript**: Fully typed for better developer experience
- ✅ **Production Ready**: Comprehensive error handling and logging
- ✅ **Discovery Enabled**: Automatic detection by Poke and other MCP clients

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│             │   SSE   │                  │ Tailscale│                 │
│  MCP Client │◄────────┤ Atlas MCP Server ├──────────┤ Atlas Monolith  │
│   (Poke)    │  JSON-  │    (Vercel)      │  (VPN)   │     Agent       │
│             │   RPC   │                  │          │                 │
└─────────────┘         └──────────────────┘         └─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Vercel account
- Tailscale network access to Atlas Monolith Agent
- Atlas API key

### Local Development

1. **Clone the repository**

```bash
git clone https://github.com/iacosta3994/atlas-mcp-server.git
cd atlas-mcp-server
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env` with your Atlas configuration:

```env
ATLAS_ENDPOINT=http://100.64.0.1:8080
ATLAS_API_KEY=your-atlas-api-key-here
NODE_ENV=development
```

4. **Run locally**

```bash
npm run dev
```

Server will be available at `http://localhost:3000`

### Deployment to Vercel

1. **Install Vercel CLI** (if not already installed)

```bash
npm install -g vercel
```

2. **Configure environment variables in Vercel**

```bash
vercel env add ATLAS_ENDPOINT
vercel env add ATLAS_API_KEY
```

3. **Deploy**

```bash
npm run deploy
```

Or use the Vercel dashboard:

1. Import the repository in Vercel
2. Add environment variables:
   - `ATLAS_ENDPOINT`
   - `ATLAS_API_KEY`
3. Deploy

## API Endpoints

### Root Endpoint (`/`)

**Discovery endpoint** that identifies the server as an MCP server.

```bash
curl https://your-server.vercel.app/
```

Response:
```json
{
  "name": "atlas-mcp-server",
  "version": "1.0.0",
  "protocol": "MCP",
  "transport": "SSE",
  "endpoints": {
    "sse": "/mcp"
  },
  "description": "MCP server for Atlas Monolith Agent integration"
}
```

### MCP SSE Endpoint (`/mcp`)

**SSE stream** for JSON-RPC 2.0 communication.

## MCP Tools

The server exposes three tools for interacting with Atlas:

### 1. `atlas_query`

Query the Atlas Monolith Agent.

**Input Schema:**
```json
{
  "query": "string (required)",
  "context": "object (optional)"
}
```

**Example:**
```json
{
  "name": "atlas_query",
  "arguments": {
    "query": "What is the current system status?",
    "context": { "priority": "high" }
  }
}
```

### 2. `atlas_execute`

Execute commands on the Atlas Monolith Agent.

**Input Schema:**
```json
{
  "command": "string (required)",
  "args": "array of strings (optional)"
}
```

**Example:**
```json
{
  "name": "atlas_execute",
  "arguments": {
    "command": "restart",
    "args": ["--graceful"]
  }
}
```

### 3. `atlas_status`

Get the current status of the Atlas Monolith Agent.

**Input Schema:**
```json
{}
```

**Example:**
```json
{
  "name": "atlas_status",
  "arguments": {}
}
```

## JSON-RPC Methods

The server implements the following JSON-RPC 2.0 methods:

- `initialize`: Initialize MCP session with capability negotiation
- `tools/list`: List available tools
- `tools/call`: Execute a tool
- `ping`: Health check

## MCP Protocol Compliance

This server follows the [MCP specification](https://spec.modelcontextprotocol.io/):

- **Protocol Version**: `2024-11-05`
- **Transport**: Server-Sent Events (SSE)
- **Message Format**: JSON-RPC 2.0
- **Capabilities**: Tool listing with change notifications

### Initialization Flow

1. Client connects to `/mcp` SSE endpoint
2. Server sends `open` event
3. Client sends `initialize` JSON-RPC request
4. Server responds with capabilities and server info
5. Client can now call tools

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ATLAS_ENDPOINT` | No | `http://100.64.0.1:8080` | Tailscale endpoint for Atlas Agent |
| `ATLAS_API_KEY` | Yes | - | API key for Atlas authentication |
| `NODE_ENV` | No | `production` | Environment mode |
| `PORT` | No | `3000` | Port for local development |

### Tailscale Configuration

Ensure your Vercel deployment has access to your Tailscale network:

1. Use Tailscale's [subnet routing](https://tailscale.com/kb/1019/subnets/) if needed
2. Configure Atlas endpoint in environment variables
3. Ensure firewall rules allow traffic from Vercel IPs (if applicable)

## Security Considerations

- ✅ API key authentication for Atlas requests
- ✅ CORS enabled with configurable origins
- ✅ Input validation on all tool calls
- ✅ Error messages sanitized (no sensitive data exposure)
- ⚠️ Consider implementing rate limiting for production
- ⚠️ Use HTTPS in production (Vercel provides this automatically)

## Monitoring & Logging

All requests and errors are logged with timestamps:

```
[2026-03-01T02:42:00.000Z] [INFO] SSE connection established {"clientId":"client-..."}
[2026-03-01T02:42:01.000Z] [INFO] Received JSON-RPC request {"method":"initialize","id":1}
[2026-03-01T02:42:02.000Z] [INFO] Tool called {"name":"atlas_query"}
```

View logs in Vercel dashboard under the Functions tab.

## Troubleshooting

### Issue: Cannot connect to Atlas

**Solution**: Verify Tailscale connectivity and ATLAS_ENDPOINT configuration.

```bash
# Test from local machine
curl http://100.64.0.1:8080/api/status
```

### Issue: SSE connection drops

**Solution**: Check Vercel function timeout limits (default 60s). For long-running connections, consider upgrading Vercel plan or implementing reconnection logic.

### Issue: JSON-RPC parse errors

**Solution**: Ensure messages are properly formatted with `jsonrpc: "2.0"` field and valid JSON.

## Development

### Project Structure

```
atlas-mcp-server/
├── src/
│   └── index.ts          # Main server implementation
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vercel.json           # Vercel deployment config
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore rules
└── README.md             # Documentation
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Building

```bash
npm run build
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

- Create an issue in this repository
- Check [MCP documentation](https://modelcontextprotocol.io)
- Review [Vercel deployment docs](https://vercel.com/docs)

## Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io)
- Deployed on [Vercel](https://vercel.com)
- Powered by [Tailscale](https://tailscale.com)

---

**Made with ❤️ by Ian Acosta**
