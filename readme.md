# Online Transaction Challange
近日拜讀到安德魯大大的文章 [架構面試題 #1, 線上交易的正確性](https://columns.chicken-house.net/2018/03/25/interview01-transaction/) 談如何正確設計線上交易的正確性，單機版本先略過不提，其中
1. 搭配 SQL Transaction  
2. 分散式鎖  
在後續的工作都有使用上，趁這個機會在練習一下  

此 Repo 主要提供環境架設 / 塞入假資料 / 測試 API 發送 / 最終驗證 / 系統隨機性錯誤，希望可以給想要練手的大家一個簡便的工具   

環境搭建使用 Docker Compose

## 測試環境說明  
到各別目錄底下執行 `$docker-compose up` 即可完成，為了便利性請使用預設的資料庫，連線方式與 Schema 會列在個別目錄下  

### 實作測試 Server
請自行啟動獨立 Server，port 與 url 不限定，請完成以下幾隻 API
#### 1. 購買商品 `POST /product/:productId`  
Sample Body
```
{
    userId: String(),
    amount: Int(),
}
```
請檢查 user 在 BandAccount 餘額是否足夠 / product 數量是否足夠，如果不足夠請返回 status code:400    
如果請求成功則對應 DB Schema 寫入 Order 紀錄 並回應 200

#### 2. `POST /error`  
測試系統不穩定時對於訂單結果的影響，收到 API Request 後請自己重啟 Server (自由心證)，藉此判斷中斷處理到一半的 Request 是否能維持正確  

## 假資料說明  
使用 faker.js 產生假資料
1. 產生 1000 個假用戶
2. 產生 1000 個假產品，stock 是 100 ~ 1100 之間，price 則由 faker.js 決定
3. 產生 1000 個假銀行帳號，balance 固定為 10000
## 執行測試  
測試方式為維持併發 10 隻 API 呼叫，隨機挑選用戶與產品，預計會發送出 2000 多筆請求，基本上設計有問題都會被抓出來，包含帳戶餘額 / 商品是否超賣等，最終會打印出 http status code 與處理時間的統計  
## 執行驗收  
驗收方式為  
1. 檢查 user 的 bank account 餘額是否有負數
2. product 的 sold 是否與有效 order 的 amount 加總正確  
3. user bank account 的餘額與 order 訂購的金額加總是否正確