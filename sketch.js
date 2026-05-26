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

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  
  // 【終極修正】避開 Mappa.js 配合 Live Server 熱重載時的致命 Bug
  // 1. 強制清除殘留的 L 變數
  if (window.L) {
    window.L = undefined;
  }
  // 2. 強制移除殘留的 leaflet 腳本標籤，防止 Mappa 找到舊標籤卻又對空變數呼叫 onload
  let oldScript = document.getElementById('leaflet');
  if (oldScript) {
    oldScript.remove();
  }
  
  // 初始化 Mappa
  mappa = new Mappa('Leaflet');
  myMap = mappa.tileMap(options);
  myMap.overlay(canvas); 
  
  fetchRainData();
}

function draw() {
  clear(); // 清除畫布，讓底下的地圖顯示出來
  
  if (!rainData || rainData.length === 0) {
    fill(0); stroke(255); strokeWeight(2); textSize(16); textAlign(LEFT, TOP);
    text("資料載入與合併中，請稍候...", 20, 20);
    return;
  }

  let hoveredStation = null;
  
  // 繪製雨量點
  for (let station of rainData) {
    // 將真實經緯度轉換為螢幕上的像素座標
    const pos = myMap.latLngToPixel(station.lat, station.lng);
    if (pos.x === -1000 || pos.y === -1000) continue; // 防止座標無效
    
    // 判斷滑鼠是否懸停於該圓標上
    let d = dist(mouseX, mouseY, pos.x, pos.y);
    let isHover = (d < 15);
    
    if (isHover) {
      hoveredStation = { data: station, pos: pos };
    }
    
    // 圓點樣式：採用紅色的圓標示該點
    if (isHover) {
      fill(255, 100, 100); 
      stroke(200, 0, 0);
      strokeWeight(2);
      ellipse(pos.x, pos.y, 20, 20); // 游標移上時放大
    } else {
      fill(255, 0, 0, 180); // 預設紅色圓點
      stroke(255);
      strokeWeight(1);
      ellipse(pos.x, pos.y, 12, 12);
    }
  }
  
  // 若有滑鼠懸停，顯示資料提示框 (Tooltip)
  if (hoveredStation) {
    let s = hoveredStation.data;
    let p = hoveredStation.pos;
    let info = `測站: ${s.name}\n雨量: ${s.rain} mm\n座標: ${s.lat.toFixed(3)}, ${s.lng.toFixed(3)}`;
    
    push();
    fill(255, 240);
    stroke(0);
    strokeWeight(1);
    rectMode(CORNER);
    
    let boxW = 160;
    let boxH = 65;
    let boxX = p.x + 15;
    let boxY = p.y - boxH - 10;
    
    // 確保提示框不會超出視窗右側或上方邊界
    if (boxX + boxW > width) boxX = p.x - boxW - 15;
    if (boxY < 0) boxY = p.y + 15;
    
    rect(boxX, boxY, boxW, boxH, 8);
    
    fill(0);
    noStroke();
    textAlign(LEFT, TOP);
    textSize(14);
    textStyle(BOLD);
    text(info, boxX + 10, boxY + 10);
    pop();
  }
}

// 正規化名稱（避免「臺」與「台」比對失敗）
function normalizeName(name) {
  return name ? name.replace(/臺/g, '台') : '';
}

async function fetchRainData() {
  const taipeiApiUrl = 'https://wic.gov.taipei/OpenData/API/Rain/Get?stationNo=&loginId=open_rain&dataKey=85452C1D';
  const cwaApiUrl = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0002-001?Authorization=rdec-key-123-45678-011121314';
  
  // 使用 AllOrigins Proxy 避開 CORS 限制
  const proxyTaipei = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(taipeiApiUrl);
  const proxyCwa = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(cwaApiUrl);

  try {
    // 1. 取得中央氣象署的經緯度資料
    let cwaRes = await fetch(proxyCwa);
    let cwaJson = await cwaRes.json();
    let stationsCwa = (cwaJson && cwaJson.records) ? (cwaJson.records.Station || cwaJson.records.location || []) : [];
    
    // 建立一個對照字典，用測站名稱找出 CWA 提供的準確座標
    let coordsDict = {};
    for (let s of stationsCwa) {
      // 確保只抓取「臺北市」的測站
      let countyName = s.GeoInfo ? s.GeoInfo.CountyName : '';
      // 舊版 API 格式相容
      if (!countyName && s.parameter) {
        let cityParam = s.parameter.find(p => p.parameterName === 'CITY');
        if (cityParam) countyName = cityParam.parameterValue;
      }
      if (normalizeName(countyName) !== '台北市') {
        continue;
      }
      
      let name = normalizeName(s.StationName || s.locationName);
      let lat, lon;
      // 解析 CWA 最新的 JSON 格式
      if (s.GeoInfo && s.GeoInfo.Coordinates && s.GeoInfo.Coordinates.length > 0) {
        let coord = s.GeoInfo.Coordinates.find(c => c.CoordinateName === 'WGS84') || s.GeoInfo.Coordinates[0];
        lat = parseFloat(coord.StationLatitude);
        lon = parseFloat(coord.StationLongitude);
      } else {
        // 舊版格式相容
        lat = parseFloat(s.lat);
        lon = parseFloat(s.lon);
      }
      coordsDict[name] = { lat, lon };
    }

    // 2. 取得台北市即時雨量資料
    let tpeRes = await fetch(proxyTaipei);
    let tpeJson = await tpeRes.json();
    let stationsTpe = Array.isArray(tpeJson) ? tpeJson : (tpeJson.data || tpeJson.list || []);

    // 3. 根據測站名稱合併資料
    rainData = [];
    for (let st of stationsTpe) {
      let name = st.stationName || st.name;
      let normName = normalizeName(name);
      let rainAmount = parseFloat(st.rain || 0);
      
      // 優先採用 CWA 氣象署的精確經緯度，如果沒有則退回使用台北市資料庫附帶的經緯度
      let lat = coordsDict[normName] ? coordsDict[normName].lat : parseFloat(st.latitude);
      let lng = coordsDict[normName] ? coordsDict[normName].lon : parseFloat(st.longitude);
      
      // 如果有合法的座標，才加入渲染清單
      if (!isNaN(lat) && !isNaN(lng)) {
        rainData.push({
          name: name,
          rain: rainAmount,
          lat: lat,
          lng: lng
        });
      }
    }
    console.log('資料載入與合併成功:', rainData);
  } catch (error) {
    console.error('抓取 API 資料時發生錯誤:', error);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (myMap) myMap.overlay(canvas);
}