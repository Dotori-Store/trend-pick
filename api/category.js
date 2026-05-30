const NAVER_SHOPPING_API_URL =
  "https://openapi.naver.com/v1/datalab/shopping";
const CATEGORY_ID = "10004489";
const CATEGORY_NAME = "신선식품";

function buildRequestBody() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

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

  const response = await fetch(`${NAVER_SHOPPING_API_URL}${endpoint}`, {
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

module.exports = async function handler(req, res) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  const base = buildRequestBody();

  if (!clientId || !clientSecret) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify(
        {
          message: "NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 없습니다.",
          categoryId: CATEGORY_ID,
          categoryName: CATEGORY_NAME,
        },
        null,
        2,
      ),
    );
    return;
  }

  try {
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

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify(
        {
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
        null,
        2,
      ),
    );
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
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
  }
};
