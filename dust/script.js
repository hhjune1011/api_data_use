// 브라우저에서는 인증키가 없는 내부 서버리스 함수만 호출합니다.
const API_URL = "/api/dust";
const regions = ["전국", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const grades = { "1": "좋음", "2": "보통", "3": "나쁨", "4": "매우나쁨" };
const regionSelect = document.querySelector("#region");
const stations = document.querySelector("#stations");
const status = document.querySelector("#status");
const average = document.querySelector("#average");
const averageNote = document.querySelector("#average-note");
let activeRequest;

// 누락값과 음수는 제외하고 유효한 숫자만 반환합니다.
function measurement(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

// 평균은 측정소별 유효 미세먼지 값의 단순 평균으로 계산합니다.
function meanPm10(items) {
  const values = items.map(item => measurement(item.pm10Value)).filter(value => value !== null);
  return { count: values.length, value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null };
}

// 선택한 시도를 서버리스 함수에 전달하고 API 오류도 사용자에게 안내합니다.
async function fetchStations(region, signal) {
  const url = `${API_URL}?sido=${encodeURIComponent(region)}`;
  const response = await fetch(url, { signal });
  let data;
  try { data = await response.json(); }
  catch {
    const local = ["localhost", "127.0.0.1"].includes(location.hostname);
    throw new Error(local ? "로컬에서는 Live Server 대신 터미널에서 vercel dev로 실행해주세요." : "서버 응답을 읽을 수 없습니다.");
  }
  if (!response.ok) throw new Error(data.message || "자료 요청에 실패했습니다.");
  const body = data.response?.body;
  if (!Array.isArray(body?.items)) throw new Error("측정 자료의 형식이 올바르지 않습니다.");
  return body.items;
}

// 측정소 이름과 값은 HTML로 해석하지 않고 텍스트로 출력합니다.
function render(items) {
  const fragment = document.createDocumentFragment();
  const template = document.querySelector("#station-template");
  for (const item of items) {
    const card = template.content.firstElementChild.cloneNode(true);
    const grade = String(item.pm10Grade ?? "").trim();
    const knownGrade = Object.hasOwn(grades, grade);
    card.classList.add(knownGrade ? `grade-${grade}` : "grade-unknown");
    card.querySelector("h3").textContent = item.stationName || "측정소 이름 없음";
    card.querySelector(".badge").textContent = knownGrade ? grades[grade] : "등급 없음";
    card.querySelector(".pm10").textContent = measurement(item.pm10Value) ?? "측정 안 됨";
    card.querySelector(".pm25").textContent = measurement(item.pm25Value) ?? "측정 안 됨";
    card.querySelector(".time").textContent = `측정 시각: ${item.dataTime && item.dataTime !== "-" ? item.dataTime : "정보 없음"}`;
    fragment.append(card);
  }
  stations.replaceChildren(fragment);
  const result = meanPm10(items);
  average.textContent = result.value === null ? "측정 안 됨" : result.value.toFixed(1);
  averageNote.textContent = `전체 ${items.length}개 측정소 중 유효한 ${result.count}개 측정소의 단순 평균`;
}

// 지역 변경 시 이전 요청을 취소하여 늦게 온 응답이 화면을 덮지 않게 합니다.
async function loadStations() {
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  const region = regionSelect.value;
  document.querySelector("#region-name").textContent = region;
  stations.replaceChildren();
  average.textContent = "—";
  averageNote.textContent = "측정 정보를 기다리고 있습니다.";
  stations.setAttribute("aria-busy", "true");
  status.textContent = `${region} 측정 정보를 불러오는 중입니다.`;
  try {
    const items = await fetchStations(region, controller.signal);
    if (controller.signal.aborted) return;
    render(items);
    status.textContent = items.length ? `${region} 측정소 ${items.length}곳 · 카드 색상은 미세먼지 등급 기준입니다.` : "선택한 지역의 측정 정보가 없습니다.";
  } catch (error) {
    if (controller.signal.aborted) return;
    status.textContent = error instanceof TypeError ? "연결할 수 없습니다. 인터넷 연결과 브라우저의 교차 출처 요청 허용 여부를 확인해 주세요." : error.message;
    averageNote.textContent = "자료를 불러오지 못했습니다. 새로고침으로 다시 시도해 주세요.";
  } finally {
    if (activeRequest === controller) stations.setAttribute("aria-busy", "false");
  }
}

// 별도 도구 없이 개발자 콘솔에서 실행할 수 있는 누락값·평균 계산 검증입니다.
function checkMeasurements() {
  const result = meanPm10([{ pm10Value: "-" }, { pm10Value: "" }, { pm10Value: "0" }, { pm10Value: "20" }]);
  if (measurement("-") !== null || measurement(null) !== null || result.count !== 2 || result.value !== 10 || meanPm10([]).value !== null) throw new Error("측정값 계산 검증 실패");
  return "측정값 계산 검증 통과";
}

// 지역 선택 목록과 새로고침 이벤트를 초기화합니다.
for (const region of regions) regionSelect.add(new Option(region, region));
regionSelect.addEventListener("change", loadStations);
document.querySelector("#refresh").addEventListener("click", loadStations);
loadStations();
