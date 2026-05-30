const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const root = __dirname;
const API_BASE = "https://openapi.naver.com/v1/datalab/shopping";
const CATEGORY_ID = "10004489";
const CATEGORY_NAME = "신선식품";

function loadLocalEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function readIndex() {
  return fs.readFileSync(path.join(root, "index.html"), "utf8");
}

function sevenDaysRange() {
  const end = new Date();
  end.setDate(end.getDate() - 1);

  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function buildBaseBody() {
  const { startDate, endDate } = sevenDaysRange();
  return {
    startDate,
    endDate,
    timeUnit: "date",
    category: [
      {
        name: CATEGORY_NAME,
        param: [CATEGORY_ID],
      },
    ],
    device: "",
    gender: "",
    ages: [],
  };
}

async function postJson(endpoint, body) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch {
    return { status: response.status, data: { raw: text } };
  }
}

async function fetchShoppingInsight() {
  const base = buildBaseBody();
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      status: 400,
      json: {
        message: "NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 없습니다.",
        categoryId: CATEGORY_ID,
        categoryName: CATEGORY_NAME,
      },
    };
  }

  const [categories, gender, age] = await Promise.all([
    postJson("/categories", base),
    postJson("/category/gender", {
      startDate: base.startDate,
      endDate: base.endDate,
      timeUnit: base.timeUnit,
      category: CATEGORY_ID,
      device: base.device,
      ages: base.ages,
    }),
    postJson("/category/age", {
      startDate: base.startDate,
      endDate: base.endDate,
      timeUnit: base.timeUnit,
      category: CATEGORY_ID,
      device: base.device,
      gender: base.gender,
    }),
  ]);

  return {
    status: 200,
    json: {
      message: "네이버 쇼핑인사이트 데이터를 불러왔습니다.",
      categoryId: CATEGORY_ID,
      categoryName: CATEGORY_NAME,
      requestBody: base,
      responses: {
        categories,
        gender,
        age,
      },
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
    },
  };
}

loadLocalEnv();

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;

  if (pathname === "/api/category") {
    fetchShoppingInsight()
      .then(({ status, json }) => {
        res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(json, null, 2));
      })
      .catch((error) => {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify(
            {
              message: "네이버 쇼핑인사이트 호출에 실패했습니다.",
              error: error.message,
            },
            null,
            2,
          ),
        );
      });
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(readIndex());
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`Local preview running at http://localhost:${PORT}`);
});
