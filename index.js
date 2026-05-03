import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import axios from "axios";
import http from "http";
import { z } from "zod";

const SHORTCUT_TOKEN = process.env.SHORTCUT_API_KEY;
const BASE_URL = process.env.SHORTCUT_BASE_URL;
const PORT = process.env.PORT || 3000;
const DEFAULT_STATE_ID = parseInt(process.env.SHORTCUT_DEFAULT_STATE_ID); // "To Do"

const server = new McpServer({ name: "shortcut-mcp", version: "1.0.0" });

// Tool: Create a Story
server.tool(
  "create_story",
  {
    name: z.string(),
    description: z.string(),
    story_type: z.enum(["feature", "bug", "chore"]),
    workflow_state_id: z.coerce.number().optional(),
  },
  async ({ name, description, story_type, workflow_state_id }) => {
    const res = await axios.post(
      `${BASE_URL}/stories`,
      {
        name,
        description,
        story_type,
        workflow_state_id: workflow_state_id || DEFAULT_STATE_ID,
      },
      { headers: { "Shortcut-Token": SHORTCUT_TOKEN } },
    );
    return { content: [{ type: "text", text: JSON.stringify(res.data) }] };
  },
);

// Tool: List Stories
server.tool("list_stories", { project_id: Number }, async ({ project_id }) => {
  const res = await axios.get(`${BASE_URL}/projects/${project_id}/stories`, {
    headers: { "Shortcut-Token": SHORTCUT_TOKEN },
  });
  return { content: [{ type: "text", text: JSON.stringify(res.data) }] };
});

// HTTP Server
const httpServer = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/mcp") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        res.on("close", () => transport.close());
        await server.connect(transport);
        await transport.handleRequest(req, res, JSON.parse(body));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok", server: "shortcut-mcp" }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

httpServer.listen(PORT, () => {
  console.log(`Shortcut MCP server running on port ${PORT}`);
});
