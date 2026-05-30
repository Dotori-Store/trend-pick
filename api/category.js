const NAVER_SHOPPING_API_URL =
  "https://openapi.naver.com/v1/datalab/shopping/categories";

function getCategoryId(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || "unknown";
  } catch {
    return "unknown";
  }
}

function getCategoryConfig() {
  const sourceUrl =
    process.env.NAVER_TARGET_CATEGORY_URL ||
    "https://search.shopping.naver.com/ns/category/100000015";
  const categoryId = getCategoryId(sourceUrl);
  const categoryName = process.env.NAVER_TARGET_CATEGORY_NAME || "신선식품";
  return { sourceUrl, categoryId, categoryName };
}

function buildRequestBody() {
  const { sourceUrl, categoryId, categoryName } = getCategoryConfig();
  const today = new Date().toISOString().slice(0, 10);

  return {
    sourceUrl,
    categoryId,
    categoryName,
    body: {
      startDate: today,
      endDate: today,
      timeUnit: "date",
      category: [
        {
          name: categoryName,
          param: [categoryId],
        },
      ],
      device: "",
      gender: "",
      ages: [],
    },
  };
}

module.exports = async function handler(req, res) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  const { sourceUrl, categoryId, categoryName, body } = buildRequestBody();

  if (!clientId || !clientSecret) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify(
        {
          message: "NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 없습니다.",
          sourceUrl,
          categoryId,
          categoryName,
        },
        null,
        2,
      ),
    );
    return;
  }

  try {
    const response = await fetch(NAVER_SHOPPING_API_URL, {
      method: "POST",
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    res.statusCode = response.ok ? 200 : response.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify(
        {
          message: response.ok
            ? "네이버 쇼핑인사이트 데이터를 불러왔습니다."
            : "네이버 쇼핑인사이트 응답을 확인했습니다.",
          sourceUrl,
          categoryId,
          categoryName,
          requestBody: body,
          response: parsed,
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
