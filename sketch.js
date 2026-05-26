let myMap;
let canvas;
let rainData = [];

// 初始化 Mappa，指定使用 Leaflet 作為圖資引擎
const mappa = new Mappa('Leaflet');

// 地圖初始設定 (聚焦於臺北市中心)
const options = {
  lat: 25.0330,
  lng: 121.5654,
  zoom: 12,
  style: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

// 原始 API 網址
const targetApiUrl = 'https://wic.gov.taipei/OpenData/API/Rain/Get?stationNo=&loginId=open_rain&dataKey=85452C1D';

// 設定 CORS 代理伺服器
// 這裡使用 allorigins，它會代理請求並補上 Access-Control-Allow-Origin: * 標頭
const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(targetApiUrl);

function setup() {
  // 設定全螢幕畫布
  canvas = createCanvas(windowWidth, windowHeight);
  
  // 建立地圖實體
  myMap = mappa.tileMap(options);
  myMap.overlay(canvas); // 將 p5 畫布疊加在地圖上方
  
  // 啟動 API 資料抓取
  fetchRainData();

  // 綁定事件：當地圖被拖曳或縮放時，重新繪製測站標點
  myMap.onChange(drawRainStations);
}

function draw() {
  // 在 Mappa 的架構下，畫面更新主要由 onChange 觸發 drawRainStations 來處理
  // 這裡不需要在 draw 迴圈中持續刷新
}

// 取得 API 資料
function fetchRainData() {
  fetch(proxyUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`網路請求失敗: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // 臺北市 API 的回傳結構通常會包裝在 data 屬性內
      // 檢查結構並賦值
      if (data && data.data) {
        rainData = data.data;
      } else if (Array.isArray(data)) {
        rainData = data;
      }
      console.log('成功取得雨量資料:', rainData);
      
      // 資料取得後觸發首次繪圖
      drawRainStations();
    })
    .catch(error => {
      console.error('抓取 API 資料時發生錯誤:', error);
    });
}

// 繪製測站與雨量資訊
function drawRainStations() {
  clear(); // 清除畫布，準備重新繪製
  
  if (!rainData || rainData.length === 0) return;
  
  for (let station of rainData) {
    // 解析經緯度
    let lat = parseFloat(station.latitude);
    let lng = parseFloat(station.longitude);
    
    // 如果經緯度無效則跳過此測站
    if (isNaN(lat) || isNaN(lng)) continue;
    
    // 將真實經緯度轉換為畫布上的 X、Y 像素座標
    const pos = myMap.latLngToPixel(lat, lng);
    
    // 取得雨量值 (兼容 API 可能的屬性名稱 rain)
    let rainAmount = parseFloat(station.rain || 0); 
    
    // 依據雨量大小設定圓點半徑
    let size = map(rainAmount, 0, 50, 15, 60); 
    size = constrain(size, 15, 60); // 限制最小與最大尺寸
    
    // 視覺化樣式設定
    if (rainAmount > 0) {
      // 有降雨：顯示藍色半透明圓點
      fill(0, 112, 255, 180);
      stroke(0, 80, 200);
      strokeWeight(2);
    } else {
      // 無降雨：顯示灰色半透明圓點
      fill(150, 150, 150, 150);
      stroke(100);
      strokeWeight(1);
    }
    
    // 繪製測站圓點
    ellipse(pos.x, pos.y, size, size);
    
    // 繪製文字標籤 (站名與雨量)
    fill(20);
    noStroke();
    textAlign(CENTER, BOTTOM);
    textSize(14);
    textStyle(BOLD);
    
    // 若沒有 stationName，則顯示為 "測站"
    let stationName = station.stationName || "測站";
    text(`${stationName}\n${rainAmount} mm`, pos.x, pos.y - (size / 2) - 5);
  }
}

// 確保視窗縮放時，畫布與地圖能同步調整
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  myMap.overlay(canvas);
}