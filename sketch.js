let rainData = null;
let scrollY = 0; // 用於滾動畫面顯示大量資料

let mappa;
let myMap;
let canvas;

const options = {
  lat: 25.0478, // 台北市中心緯度
  lng: 121.5319, // 台北市中心經度
  zoom: 12,
  style: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" // 使用 OpenStreetMap 圖資
};

function setup() {
  // 採用全螢幕畫布
  canvas = createCanvas(windowWidth, windowHeight);
  
  // 初始化 Mappa 並使用 Leaflet 作為地圖引擎
  mappa = new Mappa('Leaflet');
  myMap = mappa.tileMap(options);
  myMap.overlay(canvas); // 將 p5.js 畫布疊加在地圖上

  textSize(16);
  textAlign(LEFT, TOP);
  
  // 呼叫非同步函式取得資料
  fetchRainData();
}

function draw() {
  // 清除背景，變成透明以顯示底層的地圖
  clear();
  fill(0); // 文字設為黑色
  stroke(255); // 加上白色邊框，讓文字在地圖上更清晰
  strokeWeight(2);
  
  if (!rainData) {
    text("資料載入中，請稍候...", 20, 20);
    return;
  }
  
  if (rainData.error) {
    text(rainData.error, 20, 20);
    return;
  }

  text("台北市即時雨量資料 (使用 Proxy 取得)", 20, 20);
  
  // 繪製資料內容
  let yOffset = 60 + scrollY;
  
  // 判斷回傳的資料結構。如果有多筆測站，通常會以陣列形式放在第一層或 data 屬性內
  let stations = Array.isArray(rainData) ? rainData : (rainData.data || rainData.list || null);
  
  if (stations && Array.isArray(stations)) {
    for (let i = 0; i < stations.length; i++) {
      let station = stations[i];
      // 將單筆資料直接轉為字串顯示，以防屬性名稱與預期不同
      text(`[測站 ${i + 1}] ${JSON.stringify(station)}`, 20, yOffset, width - 40);
      yOffset += 40; // 增加間距
    }
  } else {
    // 若無法辨識為陣列，直接顯示完整的 JSON 字串
    text(JSON.stringify(rainData, null, 2), 20, yOffset, width - 40);
  }
}

async function fetchRainData() {
  const apiUrl = 'https://wic.gov.taipei/OpenData/API/Rain/Get?stationNo=&loginId=open_rain&dataKey=85452C1D';
  
  // 使用公共的 CORS 代理伺服器 (CORS Proxy)
  // 代理伺服器會幫你去台北市政府的 API 拿取資料（伺服器對伺服器不會有 CORS 限制），然後再加上 Access-Control-Allow-Origin: * 的標頭，把資料回傳給你的瀏覽器。
  const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(apiUrl);
  
  try {
    const response = await fetch(proxyUrl, { method: 'GET' });
    rainData = await response.json();
  } catch (error) {
    console.error('取得資料失敗:', error);
    rainData = { error: '無法取得即時雨量資料，請檢查網路狀態或代理伺服器。' };
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function mouseWheel(event) {
  // 使用滑鼠滾輪來上下滑動查看資料
  scrollY -= event.delta;
  if (scrollY > 0) scrollY = 0;
}
