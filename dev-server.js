const http = require("http");
const fs = require("fs");
const path = require("path");

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzx6uh9fJPU4GysqK6DetNMf2W6Bf0oXI6P9p3GxipOCgglgg5IpbUfKdaPY6kng5iZ/exec";
const PORT = Number(process.env.PORT || 8001);
const ROOT = __dirname;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), "application/json; charset=utf-8");
}

function redirect(res, location) {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end();
}

async function proxyGas(req, res) {
  const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
  const gasUrl = new URL(GAS_URL);

  requestUrl.searchParams.forEach((value, key) => {
    gasUrl.searchParams.set(key, value);
  });

  try {
    const options = { method: req.method };

    if (req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      options.body = Buffer.concat(chunks).toString("utf8");
      options.headers = {
        "Content-Type": req.headers["content-type"] || "text/plain;charset=utf-8",
      };
    }

    const gasRes = await fetch(gasUrl, options);
    const text = await gasRes.text();

    res.writeHead(gasRes.status, {
      "Content-Type":
        gasRes.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    res.end(text);
  } catch (error) {
    sendJson(res, 502, {
      success: false,
      error: error.message || "Apps Scriptへの接続に失敗しました。",
    });
  }
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
  if (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html") {
    redirect(res, "/public/");
    return;
  }
  if (requestUrl.pathname === "/login/") {
    redirect(res, "/auth/login.html");
    return;
  }
  if (requestUrl.pathname === "/admin.html") {
    redirect(res, "/admin/");
    return;
  }

  const pathname = decodeURIComponent(requestUrl.pathname);
  const relativePath =
    pathname === "/"
      ? "index.html"
      : pathname.endsWith("/")
        ? path.join(pathname.slice(1), "index.html")
        : pathname.slice(1);
  const filePath = path.resolve(ROOT, relativePath);

  if (!filePath.startsWith(ROOT + path.sep)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }

    send(
      res,
      200,
      data,
      contentTypes[path.extname(filePath)] || "application/octet-stream",
    );
  });
}

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      send(res, 204, "");
      return;
    }

    if (req.url.startsWith("/api/gas")) {
      proxyGas(req, res);
      return;
    }

    serveStatic(req, res);
  })
  .listen(PORT, () => {
    console.log(`Local blog server running at http://localhost:${PORT}/`);
  });
