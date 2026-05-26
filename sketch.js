let rainData = null;
let scrollY = 0; // 用於滾動畫面顯示大量資料

function setup() {
  // 採用全螢幕畫布
  createCanvas(windowWidth, windowHeight);
  textSize(16);
  textAlign(LEFT, TOP);
  
  // 呼叫非同步函式取得資料
  fetchRainData();
}

function draw() {
  background(30);
  fill(255);
  
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
  
  // 在程式碼內設定代理伺服器 (Proxy)，使用 corsproxy.io 來繞過 localhost 的 CORS 限制
  const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(apiUrl);
  
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

