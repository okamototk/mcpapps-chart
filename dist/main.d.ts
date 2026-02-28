#!/usr/bin/env node
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export declare function startStreamableHTTPServer(createServerInstance: () => McpServer): Promise<void>;
export declare function startStdioServer(createServerInstance: () => McpServer): Promise<void>;
