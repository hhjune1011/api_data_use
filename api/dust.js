// 에어코리아 인증키를 숨긴 채 측정소 정보를 전달하는 Vercel 서버리스 함수입니다.
module.exports = async function handler(req, res) {
  const sido = String(req.query.sido || "서울").trim() || "서울";
  const key = process.env.AIRKOREA_KEY;

  if (!key) return res.status(500).json({ message: "서버의 인증키 설정을 확인해주세요" });

  const url =
    "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty" +
    `?serviceKey=${encodeURIComponent(key)}` +
    `&returnType=json&sidoName=${encodeURIComponent(sido)}` +
    "&numOfRows=100&pageNo=1&ver=1.3";

  try {
    const response = await fetch(url);
    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(400).json({ message: "인증키 또는 요청값을 확인해주세요" });
    }

    const header = data.response?.header;
    if (!response.ok || String(header?.resultCode) !== "00") {
      return res.status(400).json({ message: "인증키 또는 요청값을 확인해주세요" });
    }

    return res.status(200).json(data);
  } catch {
    return res.status(502).json({ message: "에어코리아 서버에 연결할 수 없습니다" });
  }
};
