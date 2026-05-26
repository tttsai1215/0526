let myMap;
let canvas;
let rainData = [];
let mappa;
let hoveredListItem = null; // 紀錄左側清單被滑鼠移過的測站

// 地圖初始設定
const options = {
  lat: 25.0330,
  lng: 121.5654,
  zoom: 12,
  style: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

// 台北市主要測站經緯度座標對照表 (用於地圖定位)
const stationCoords = {
  "湖田國小": { lat: 25.1528, lon: 121.5323 },
  "大屯國小": { lat: 25.1741, lon: 121.4925 },
  "桃源國中": { lat: 25.1397, lon: 121.4914 },
  "北投國小": { lat: 25.1321, lon: 121.5005 },
  "陽明高中": { lat: 25.0945, lon: 121.5148 },
  "太平國小": { lat: 25.0610, lon: 121.5111 },
  "民生國中": { lat: 25.0602, lon: 121.5606 },
  "中正國中": { lat: 25.0336, lon: 121.5201 },
  "三興國小": { lat: 25.0303, lon: 121.5583 },
  "格致國中": { lat: 25.1362, lon: 121.5387 },
  "平等國小": { lat: 25.1278, lon: 121.5714 },
  "至善國中": { lat: 25.1014, lon: 121.5489 },
  "碧湖國小": { lat: 25.0811, lon: 121.5878 },
  "東湖國小": { lat: 25.0689, lon: 121.6169 },
  "瑠公國中": { lat: 25.0372, lon: 121.5847 },
  "舊莊國小": { lat: 25.0402, lon: 121.6186 },
  "博嘉國小": { lat: 25.0000, lon: 121.5886 },
  "北政國中": { lat: 24.9861, lon: 121.5786 },
  "長安國小": { lat: 25.0489, lon: 121.5283 },
  "萬華國中": { lat: 25.0278, lon: 121.4986 },
  "台灣大學(新)": { lat: 25.0175, lon: 121.5397 },
  "雙園": { lat: 25.0232, lon: 121.4925 },
  "中洲": { lat: 25.1235, lon: 121.4608 }
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
  
  // 建立浮動在畫面上方的 UI (使用 HTML 元素，完全不受地圖縮放、拖曳影響)
  let hud = createDiv("臺北市即時雨量地圖<br><span style='font-size:18px;'>414730134 蔡忞序</span>");
  hud.style('position', 'absolute');
  hud.style('right', '20px');
  hud.style('top', '20px');
  hud.style('color', '#FFD700'); // 金黃色
  hud.style('font-size', '26px');
  hud.style('font-weight', 'bold');
  hud.style('text-shadow', '2px 2px 5px rgba(0,0,0,0.9)');
  hud.style('text-align', 'right');
  hud.style('z-index', '9999'); // 確保在最上層
  hud.style('pointer-events', 'none'); // 讓滑鼠可以穿透，不影響拖曳地圖
  
  let legend = createDiv(
    "<b>降雨量顏色區分</b><br>" +
    "🔴 🔴 紅色：> 40mm (大雨)<br>" +
    "🟠 🟠 橘色：10 - 40mm (中雨)<br>" +
    "🔵 🔵 藍色：0.1 - 10mm (小雨)<br>" +
    "⚪ ⚪ 灰色：0mm (無雨)"
  );
  legend.style('position', 'absolute');
  legend.style('right', '20px');
  legend.style('bottom', '30px');
  legend.style('background', 'rgba(0,0,0,0.7)');
  legend.style('color', 'white');
  legend.style('padding', '10px 15px');
  legend.style('border-radius', '8px');
  legend.style('font-size', '15px');
  legend.style('line-height', '1.6');
  legend.style('z-index', '9999');
  legend.style('pointer-events', 'none');

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
  
  // 繪製右上角天氣動畫 (大太陽 / 下雨)
  drawWeatherEffect();

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
    
    let rainAmount = parseFloat(station.rain || 0);
    let baseSize = 12;
    let pulse = 0;
    
    // 依據你的需求自訂的顏色區分
    let dotColor, strokeColor;
    if (rainAmount > 40) {
      dotColor = color(255, 50, 50, 200); // 紅色 (大雨)
      strokeColor = color(255, 200, 200);
    } else if (rainAmount > 10) {
      dotColor = color(255, 150, 0, 200); // 橘色 (中雨)
      strokeColor = color(255, 220, 150);
    } else if (rainAmount > 0) {
      dotColor = color(0, 150, 255, 200); // 藍色 (小雨)
      strokeColor = color(200, 230, 255);
    } else {
      dotColor = color(150, 150, 150, 150); // 灰色/白色系 (無雨)
      strokeColor = color(240);
    }

    let isListHover = (hoveredListItem === station.name);

    // 有雨時的明顯特效：放大 + 動態外擴漣漪
    if (rainAmount > 0) {
      baseSize = map(rainAmount, 0, 50, 15, 45); // 依雨量放大
      baseSize = constrain(baseSize, 15, 60);
      pulse = sin(frameCount * 0.1) * 4; // 呼吸燈縮放
      
      // 繪製藍色擴散漣漪
      let rippleSize = baseSize + (frameCount % 60) * 1.5;
      let rippleAlpha = map(frameCount % 60, 0, 60, 200, 0);
      noFill();
      stroke(red(dotColor), green(dotColor), blue(dotColor), rippleAlpha);
      strokeWeight(3);
      ellipse(pos.x, pos.y, rippleSize, rippleSize);
    }
    
    let finalSize = baseSize + pulse;
    
    // 圓點樣式判定
    if (isListHover) {
      // 游標在左側面板對應站名上，極度放大與強調
      fill(255, 255, 0);
      stroke(255);
      strokeWeight(4);
      finalSize += 25; // 加大直徑
      pulse += sin(frameCount * 0.3) * 6; // 增加脈動
      hoveredStation = { data: station, pos: pos }; // 同時觸發資料框顯示
    } else if (isHover) {
      fill(255, 200, 0); 
      stroke(255);
      strokeWeight(3);
      finalSize += 8; // 游標移上地圖圓點時放大
    } else {
      fill(dotColor);
      stroke(strokeColor);
      strokeWeight(rainAmount > 0 ? 2 : 1.5);
    }
    
    ellipse(pos.x, pos.y, finalSize, finalSize);

    // 在地圖上顯示該站名 (加上白邊黑字，更清晰)
    fill(0);
    stroke(255);
    strokeWeight(3);
    textSize(13);
    textStyle(BOLD);
    textAlign(CENTER, BOTTOM);
    text(station.name, pos.x, pos.y - (finalSize / 2 + (isHover ? 8 : 4)));
  }
  
  // 若有滑鼠懸停，顯示資料提示框 (Tooltip)
  if (hoveredStation) {
    let s = hoveredStation.data;
    let p = hoveredStation.pos;
    let info = `測站: ${s.name}\n雨量: ${s.rain} mm\n座標: ${s.lat.toFixed(3)}, ${s.lng.toFixed(3)}`;
    
    push();
    fill(0, 220); // 加深半透明黑色背景
    stroke(255, 200); // 邊框改為淡白色
    strokeWeight(2);
    rectMode(CORNER);
    
    let boxW = 160;
    let boxH = 65;
    
    // 若是透過滑鼠直接互動則跟隨滑鼠；若是透過左側清單 Hover 則顯示在圓點旁
    let boxX = (mouseX > 260 && !hoveredListItem) ? mouseX + 15 : p.x + 20; 
    let boxY = (mouseX > 260 && !hoveredListItem) ? mouseY + 15 : p.y - boxH / 2;
    
    // 確保提示框不會超出視窗右側或下方邊界
    if (boxX + boxW > width) boxX = mouseX - boxW - 15;
    if (boxY + boxH > height) boxY = mouseY - boxH - 15;
    
    // 增加提示框的陰影質感，讓它看起來像浮起來的卡片
    drawingContext.shadowOffsetX = 4;
    drawingContext.shadowOffsetY = 4;
    drawingContext.shadowBlur = 8;
    drawingContext.shadowColor = 'rgba(0,0,0,0.6)';
    
    rect(boxX, boxY, boxW, boxH, 8);
    
    // 取消陰影以免影響文字
    drawingContext.shadowOffsetX = 0;
    drawingContext.shadowOffsetY = 0;
    drawingContext.shadowBlur = 0;
    
    fill(255); // 字體改為白色
    noStroke();
    textAlign(LEFT, TOP);
    textSize(14);
    textStyle(BOLD);
    text(info, boxX + 10, boxY + 10);
    pop();
  }
}

// 繪製右上角天氣特效
function drawWeatherEffect() {
  let maxRain = 0;
  if (rainData && rainData.length > 0) {
    maxRain = Math.max(...rainData.map(d => d.rain));
  }
  
  let wx = width - 100;
  let wy = 120; // 在 HUD 資訊的下方
  
  push();
  translate(wx, wy);
  if (maxRain === 0) {
    // 大太陽
    noStroke();
    fill(255, 204, 0, 200);
    push();
    rotate(frameCount * 0.02);
    for (let i = 0; i < 8; i++) {
      ellipse(0, 30, 8, 20);
      rotate(PI / 4);
    }
    pop();
    fill(255, 204, 0);
    circle(0, 0, 45);
  } else {
    // 烏雲與下雨效果
    noStroke();
    fill(180, 180, 180, 220);
    ellipse(0, -10, 70, 35);
    ellipse(-25, -5, 50, 30);
    ellipse(25, -5, 50, 30);
    
    stroke(100, 200, 255, 180);
    strokeWeight(2);
    let rainDrops = (frameCount * 6) % 40;
    for(let i = 0; i < 5; i++){
       let rx = -25 + i * 12;
       let ry = ((rainDrops + i * 9) % 40);
       line(rx, ry, rx - 4, ry + 12);
    }
  }
  pop();
}

// 建立左側面板
function buildSidePanel() {
  let oldPanel = document.getElementById('side-panel');
  if (oldPanel) oldPanel.remove();

  let sidePanel = createDiv();
  sidePanel.id('side-panel');
  sidePanel.style('position', 'absolute');
  sidePanel.style('left', '20px');
  sidePanel.style('top', '20px');
  sidePanel.style('bottom', '20px');
  sidePanel.style('width', '240px');
  sidePanel.style('background', 'rgba(0, 0, 0, 0.75)');
  sidePanel.style('color', 'white');
  sidePanel.style('overflow-y', 'auto');
  sidePanel.style('border-radius', '8px');
  sidePanel.style('z-index', '9999');
  sidePanel.style('padding', '15px');
  sidePanel.style('box-sizing', 'border-box');
  sidePanel.style('box-shadow', '3px 3px 10px rgba(0,0,0,0.5)');

  let title = createDiv('<h3>北市測站雨量列表</h3>');
  title.style('margin-top', '0');
  title.style('border-bottom', '1px solid #777');
  title.style('padding-bottom', '10px');
  title.parent(sidePanel);
  
  // 依雨量大小排序
  let sortedData = [...rainData].sort((a, b) => b.rain - a.rain);
  
  for (let st of sortedData) {
    let item = createDiv(`<b>${st.name}</b> : ${st.rain} mm`);
    item.style('padding', '10px 5px');
    item.style('border-bottom', '1px solid #444');
    item.style('cursor', 'pointer');
    item.style('transition', 'background 0.2s, padding-left 0.2s');
    
    item.mouseOver(() => {
      item.style('background', 'rgba(255, 255, 255, 0.2)');
      item.style('padding-left', '15px'); // Hover 時稍微向右縮排
      hoveredListItem = st.name;
    });
    item.mouseOut(() => {
      item.style('background', 'transparent');
      item.style('padding-left', '5px');
      if (hoveredListItem === st.name) hoveredListItem = null;
    });
    
    item.parent(sidePanel);
  }
}

// 正規化名稱（避免「臺」與「台」比對失敗）
function normalizeName(name) {
  return name ? name.replace(/臺/g, '台') : '';
}

async function fetchRainData() {
  const taipeiApiUrl = 'https://wic.gov.taipei/OpenData/API/Rain/Get?stationNo=&loginId=open_rain&dataKey=85452C1D';
  const cwaApiUrl = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0002-001?Authorization=rdec-key-123-45678-011121314';

  let coordsDict = {};

  try {
    // 1. 取得中央氣象署的經緯度資料 (加上獨立的 try-catch，防止氣象署伺服器異常導致整個程式當機)
    try {
      let cwaRes = await fetch(cwaApiUrl);
      if (cwaRes.ok) {
        let cwaText = await cwaRes.text();
        let cwaJson = JSON.parse(cwaText);
        let stationsCwa = (cwaJson && cwaJson.records) ? (cwaJson.records.Station || cwaJson.records.location || []) : [];
        
        // 建立一個對照字典，用測站名稱找出 CWA 提供的準確座標
        for (let s of stationsCwa) {
          // 確保只抓取「臺北市」的測站
          let countyName = s.GeoInfo ? s.GeoInfo.CountyName : '';
          if (!countyName && s.parameter) {
            let cityParam = s.parameter.find(p => p.parameterName === 'CITY');
            if (cityParam) countyName = cityParam.parameterValue;
          }
          if (normalizeName(countyName) !== '台北市') continue;
          
          let name = normalizeName(s.StationName || s.locationName);
          let lat, lon;
          // 解析 CWA 最新的 JSON 格式
          if (s.GeoInfo && s.GeoInfo.Coordinates && s.GeoInfo.Coordinates.length > 0) {
            let coord = s.GeoInfo.Coordinates.find(c => c.CoordinateName === 'WGS84') || s.GeoInfo.Coordinates[0];
            lat = parseFloat(coord.StationLatitude);
            lon = parseFloat(coord.StationLongitude);
          } else {
            lat = parseFloat(s.lat);
            lon = parseFloat(s.lon);
          }
          coordsDict[name] = { lat, lon };
        }
      }
    } catch (e) {
      console.warn('氣象署 API 抓取失敗，將只使用自訂與預設的台北市座標:', e);
    }

    // 2. 取得台北市即時雨量資料 (需透過 Proxy 避開 CORS)
    // 準備三個不同的免費 Proxy，如果一個失敗就自動換下一個
    let proxies = [
      'https://corsproxy.io/?',
      'https://api.allorigins.win/raw?url=',
      'https://api.codetabs.com/v1/proxy?quest='
    ];
    
    let tpeJson = null;
    for (let proxy of proxies) {
      try {
        console.log(`嘗試透過 ${proxy} 抓取台北市 API...`);
        let tpeRes = await fetch(proxy + encodeURIComponent(taipeiApiUrl));
        if (!tpeRes.ok) throw new Error(`狀態碼: ${tpeRes.status}`);
        
        let tpeText = await tpeRes.text();
        // 檢查是否為合法 JSON (避免代理伺服器回傳純文字錯誤網頁如 Oops...)
        if (!tpeText.trim().startsWith('[') && !tpeText.trim().startsWith('{')) {
           throw new Error(`回傳的不是有效 JSON: ${tpeText.substring(0, 30)}...`);
        }
        
        tpeJson = JSON.parse(tpeText);
        console.log('台北市 API 抓取成功！');
        break; // 成功就跳出迴圈
      } catch (err) {
        console.warn(`代理伺服器 ${proxy} 失敗: ${err.message}`);
      }
    }
    
    if (!tpeJson) throw new Error("所有代理伺服器皆無法抓取台北市 API。");

    let stationsTpe = Array.isArray(tpeJson) ? tpeJson : (tpeJson.data || tpeJson.list || []);

    // 3. 根據測站名稱合併資料
    rainData = [];
    for (let st of stationsTpe) {
      let name = st.stationName || st.name;
      let normName = normalizeName(name);
      let rainAmount = parseFloat(st.rain || 0);
      
      // 優先採用自訂的 stationCoords，再來是 CWA 氣象署，如果都沒有才退回使用台北市資料庫附帶的經緯度
      let lat, lng;
      if (stationCoords[name]) {
        lat = stationCoords[name].lat;
        lng = stationCoords[name].lon;
      } else if (stationCoords[normName]) {
        lat = stationCoords[normName].lat;
        lng = stationCoords[normName].lon;
      } else if (coordsDict[normName]) {
        lat = coordsDict[normName].lat;
        lng = coordsDict[normName].lon;
      } else {
        lat = parseFloat(st.latitude);
        lng = parseFloat(st.longitude);
      }
      
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
    buildSidePanel(); // 資料合併完成後呼叫建立側邊欄
  } catch (error) {
    console.error('抓取 API 資料時發生錯誤:', error);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (myMap) myMap.overlay(canvas);
}