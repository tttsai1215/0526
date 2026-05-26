let myMap;
let canvas;
let rainData = [];
let mappa; 

// 地圖初始設定
const options = {
  lat: 25.0330,
  lng: 121.5654,
  zoom: 12,
  style: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

// API 網址與代理伺服器設定
const targetApiUrl = 'https://wic.gov.taipei/OpenData/API/Rain/Get?stationNo=&loginId=open_rain&dataKey=85452C1D';
const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(targetApiUrl);

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  
  // 初始化 Mappa (這時 Leaflet 已經確定載入完畢)
  mappa = new Mappa('Leaflet');
  myMap = mappa.tileMap(options);
  myMap.overlay(canvas); 
  
  fetchRainData();

  // 綁定地圖變動事件
  myMap.onChange(drawRainStations);
}

function draw() {
  // 畫面交由 onChange 處理
}

function fetchRainData() {
  fetch(proxyUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`網路請求失敗: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data && data.data) {
        rainData = data.data;
      } else if (Array.isArray(data)) {
        rainData = data;
      }
      console.log('成功取得雨量資料:', rainData);
      drawRainStations();
    })
    .catch(error => {
      console.error('抓取 API 資料時發生錯誤:', error);
    });
}

function drawRainStations() {
  clear(); 
  
  if (!rainData || rainData.length === 0) return;
  
  for (let station of rainData) {
    let lat = parseFloat(station.latitude);
    let lng = parseFloat(station.longitude);
    
    if (isNaN(lat) || isNaN(lng)) continue;
    
    // 經緯度轉像素座標
    const pos = myMap.latLngToPixel(lat, lng);
    let rainAmount = parseFloat(station.rain || 0); 
    
    let size = map(rainAmount, 0, 50, 15, 60); 
    size = constrain(size, 15, 60); 
    
    // 視覺樣式
    if (rainAmount > 0) {
      fill(0, 112, 255, 180); 
      stroke(0, 80, 200);
      strokeWeight(2);
    } else {
      fill(150, 150, 150, 150); 
      stroke(100);
      strokeWeight(1);
    }
    
    ellipse(pos.x, pos.y, size, size);
    
    // 文字標籤
    fill(20);
    noStroke();
    textAlign(CENTER, BOTTOM);
    textSize(14);
    textStyle(BOLD);
    
    let stationName = station.stationName || "測站";
    text(`${stationName}\n${rainAmount} mm`, pos.x, pos.y - (size / 2) - 5);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  myMap.overlay(canvas);
}