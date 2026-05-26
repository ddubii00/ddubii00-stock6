const http = require('http');

async function test() {
      const headers = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'http://finance.daum.net/' };
      const rKospiDaum = await fetch('https://finance.daum.net/api/market_index/days?page=1&perPage=20&market=KOSPI&pagination=true', { headers });
      const jsonKospi = await rKospiDaum.json();
      const kospiData = jsonKospi.data || [];
      
      let prog = -1000;
      let futures = [0, 0, 0, 0, 0]; // 1, 3, 5, 10, 20
      let progs = [prog, 0, 0, 0, 0];

      if (kospiData.length > 0) {
        let sum = 0;
        for (let i = 0; i < kospiData.length && i < 20; i++) {
          sum += Math.round(kospiData[i].foreignStraightPurchasePrice / 100000000);
          if (i === 0) futures[0] = sum;
          if (i === 2) futures[1] = sum;
          if (i === 4) futures[2] = sum;
          if (i === 9) futures[3] = sum;
          if (i === 19 || i === kospiData.length - 1) futures[4] = sum;
        }
        if (futures[0] !== 0) {
          const ratio = prog / futures[0];
          progs[1] = Math.round(futures[1] * ratio);
          progs[2] = Math.round(futures[2] * ratio);
          progs[3] = Math.round(futures[3] * ratio);
          progs[4] = Math.round(futures[4] * ratio);
        } else {
          progs = [prog, prog*3, prog*5, prog*10, prog*20];
        }
      }
      console.log('futures:', futures);
      console.log('progs:', progs);
}
test();
