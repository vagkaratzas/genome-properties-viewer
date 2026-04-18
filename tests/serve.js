#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.TEST_PORT) || 4321;
const ROOT = path.join(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".map": "application/json",
};

const server = http.createServer((req, res) => {
  const url = req.url === "/" ? "/tests/index.html" : req.url;
  const filePath = path.join(ROOT, url.split("?")[0]);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  // Signal to Playwright that the server is ready
  process.stdout.write(`Test server listening at http://127.0.0.1:${PORT}\n`);
});
