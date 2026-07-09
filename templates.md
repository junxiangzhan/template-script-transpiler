# 快速交易模版

## 型別

快速交易腳本使用了以下 JavaScript 型別：

- 布林值：使用 `true` 表示真，`false` 表示假
- 數字：使用數字字面量表示，如 `10500`
- 字串：可以使用字串字面量建立，如 `"this is a string"`
- 空值：使用 `null` 表示
- 未定義：使用 `undefined` 表示
- 陣列：使用陣列字面量表示，如：`[true, "string", 123]`

為了處理特殊功能，也定義了以下物件：

- 物件（非 JavaScript 的 Plain Object）：使用 `$pack` 運算建立
- 時間點：使用 `$datetime` 運算建立
- 時間差：使用 `$deltatime` 運算建立
- 金額：使用 `$amount` 運算建立
- 交易：僅能利用表單功能取得，或透過 `$query-transaction` 查詢
- 會計科目：利用表單功能取得，或透過 `$query-account` 查詢
- 標籤：利用表單功能取得，或透過 `$query-tag` 查詢
- 表單欄位：使用 `$col` 運算建立
- 推薦選項：使用 `$suggest-option` 運算建立
- 分錄行：使用 `$entry-line` 運算建立

若嘗試取得非上列的型別或物件（如特定的方法函數），將會被替換為 `undefined`。

### 數值型別

布林值、數字、時間點、時間差、金額皆被視為數值型別（Numeric），但有以下差別：

- 布林值：模數為 2 的整數域有限體中，無量綱純量（參與數值運算時，總是映射為整數 0 與 1）
- 數字：實數域中，無量綱純量
- 時間點：整數域中，量綱為「時間」的座標
- 時間差：整數域中，量綱為「時間」的純量
- 金額：整數域中，量綱為指定貨幣單位的純量

數值運算過程皆在實數域進行。涉及小數轉換時，金額類型採用帳本設定之捨入法，其餘型別一律強制採用銀行家捨入法（Banker's Rounding，四捨六入五成雙）捨入至最近整數。

相同量綱的純量才能夠相加、減；有量綱的純量僅能與無量綱的純量相乘；有量綱的純量（運算元左測）僅能作為無量綱純量（運算元右側）的被除數。相同量綱的純量相除後會得到純量。

座標與座標相減後會得到對應量綱的純量；座標（運算元左側）僅能作為相同量綱的純量（運算元右側）的被加數與被減數，視為座標平移。

模數操作是減法。

## 變數

### 識別符

識別符為不包含 `.` 的任意字串，不論連字符 `-`、空白 ` `、控制符號。

```json
[
  { "$": "get", "target": "identifier1" },
  { "$": "get", "target": "a very long identifier" },
  { "$": "get", "target": "a identifier with \"\u0000\" character" }
]
```

如果有結尾空白，也會被視為不同識別符：

```json
"123"
" 123"
"123 "
" 123 "
```

由於字串字面量的插入規則，若要使用 `%` 作為識別符的一部份，應使用 `%%` 插入。

### 取值與賦值

可以使用 `$set` 運算為指定的識別符，並使用 `$get` 取得指定的識別符：

```json
[
  { "$": "set", "target": "my-variable", "value": true }, // 寫入
  { "$": "get", "target": "my-variable" }                 // 讀取
]
```

可以使用 `.` 串接識別符，以讀取或寫入指定的屬性或索引：

```json
[
  { "$": "set", "target": "my-array", "value": [1, 2, 3] }, // 寫入
  { "$": "get", "target": "my-array.length" }               // 取得陣列長度
  { "$": "set", "target": "my-array.0", "value": 0 },       // 取得第一個（索引 0）值
]
```

如果嘗試取得未指派識別符的值，會取得 `undefined`。

若嘗試寫入未指派識別符的屬性，則該次的寫入行為將被忽略；若嘗試讀取未指派識別符的屬性，則會取得 `undefined`。

以下識別符是唯讀的，若嘗試寫入，寫入行為將被忽略：

- `""`（空字串）：百分比符號字串 `"%"`

### 字串字面量

所有的字串字面量，包含 JSON 物件字面量的屬性，都能夠利用 `%...%` 語法插入指定識別符的值。

使用方法與 `$get` 類似，可以使用 `.` 串接識別符，以讀取或寫入指定的屬性或索引。

```json
[
  { "$": "set", "target": "my-array", "value": [1, 2, 3, 4, 5] },
  { "$": "set", "target": "operator", "value": "sub" },
  { "$": "set", "target": "argument name", "value": "operands" },
  {
    "$": "set",
    "target": "final index",
    "value": { 
      "$": "%operator%", 
      "%argument name%": [{ "$": "get", "value": "my-array.length" }, 1]
    }
  },
  {
    "$": "set", "target": "final value",
    "value": { "$get": "my-array.%final index%" }
  }
]
```

使用 `%%` 插入一個百分比符號。

如果 `%` 無法配對會導致運行時崩潰（Panic），將中斷所有模版運行，包括呼叫來源的模版，並在使用者介面彈出錯誤提示。

## 物件建立

### 物件

使用 `$pack` 建立物件，並將設定指定屬性值：

```json
{
  "$": "pack",
  "pack": {
    "prop1": "expr1",
    "prop2": "expr2",
    "...": "..."
  }
}
```

- `"pack"`：包含數個鍵值對的物件，將作為建立物件的屬性與屬性值（預設值為 `{}`）

屬性名稱若包含 `.`，將可能會因為 `$get` 的存取規則而無法取得。

### 時間點

使用 `$datetime` 建立時間點：

```json
{
  "$": "datetime",
  "datetime": {
    "year": "expr",
    "month": "expr",
    "date": "expr",
    "hour": "expr",
    "minute": "expr",
    "second": "expr",
    "nanosecond": "expr"
  }
}
```

- `"year"`：整數，表示西元年份
- `"month"`：`1` 至 `12` 的整數，表示月份
- `"date"`：`1` 至 `28`、`29`、`30` 或 `31` 的整數（視年份與月份而定），表示該月的日期
- `"hour"`：`0` 至 `23` 的整數，表示該日的小時數
- `"minute"`：`0` 至 `59` 的整數，表示該日的分鐘數
- `"second"`：`0` 至 `59` 的整數，表示該日的秒數
- `"nanosecond"`：`0` 至 `99999999` 的整數，表示該日的納秒數
- 以上欄位皆可選，預設選用系統時間，若 `"year"`、`"month"`、`"date"` 任一欄位被設置，較小的時間欄位的預設值將選用合理值範圍的最小值。若給定值超出合理範圍，會影響其他欄位。

### 時間差

使用 `$deltatime` 建立時間差：

```json
{
  "$": "deltatime",
  "deltatime": {
    "years": "expr",
    "months": "expr",
    "weeks": "expr",
    "days": "expr",
    "hours": "expr",
    "minutes": "expr",
    "seconds": "expr",
    "nanoseconds": "expr"
  }
}
```

- `"years"`：整數，表示時間差天數
- `"months"`：整數，表示時間差天數
- `"weeks"`：整數，表示時間差週數
- `"days"`：整數，表示時間差天數
- `"hours"`：與整體同方向 `0` 至 `23` 的整數，表示時間差小時數
- `"minutes"`：與整體同方向 `0` 至 `59` 的整數，表時間差分鐘數
- `"seconds"`：與整體同方向 `0` 至 `59` 的整數，表時間差秒數
- `"nanoseconds"`：與整體同方向 `0` 至 `99999999` 的整數，表時間差納秒數
- 以上欄位皆可選，預設值為 0。若給定值超出合理範圍，會影響其他欄位。

日、小時、分鐘、秒及納秒是精確的，日期相減時只會使用這些欄位。  
年、月、週是相對的，使用這些欄位將因為大、小月份、閏年等因素產生差異。

### 金額

使用 `$amount` 建立金額：

```json
{ "$": "amount", "amount": "expr" }
```

- `"amount"`：金額數值，將按帳本規則捨入至指定小數。

### 欄位物件

欄位物件可以使用 `$col` 建立：

```json
{
  "$": "col",
  "col": {
    "target": "identifier",
    "name": "...",
    "description": "...",
    "hidden": false,
    "type": "amount",
    "multiple": false,

    "default": 100,
    "suggestions": {
      "options": [],
      "limited": false
    },

    "validation": {}
  }
}
```

- `"target"`：寫入的識別符
- `"name"`：欄位名稱
- `"description"`：欄位說明
- `"hidden"`：是否顯示該欄位（預設值為 `false`）
- `"type"`：欄位型別
  - `"boolean"`：布林值
  - `"number"`：數值
  - `"string"`：字串
  - `"transaction"`：選擇已有的交易或建立交易並選取
  - `"account"`：科目
  - `"tag"`：標籤    
  - `"datetime"`、`"date"`：時間點
  - `"time"`：時間差
  - `"amount"`：金額
- `"multiple"`：是否搜集多個值
  - `false`：不搜集多個值（預設值）
  - `true` 或 `{}`（空物件）：將基於原型別進一步變為陣列型別，無限制
  - `{"count": 2}` 指定陣列的長度
  - `{"least": 0, "most": 3}` 陣列的長度將被限制（屬性可選）
- `"default"`：欄位顯示時的初始值，或欄位隱藏時的選用值（預設值為 `undefined`）
- `"suggestions"`：欄位的推薦值
  - `"options"`：推薦選項物件陣列（預設值為 `[]`）
  - `"limited"`：是否限選用推薦值（預設值為 `false`）
- `"validation"`：欄位檢查
  - `false`：不檢查（預設值）
  - 物件：套用指定的檢查

當 `"type"` 欄位有以下值時，`"validation"` 應用以下屬性（忽略其他屬性）：

- `"number"`、`"amount"`、`"datetime"`、`"date"`、`"time"`：
  - `"min"` 最小值
  - `"max"` 最大值
  - `"step"` 數值跨步
   所有的可選值為 $min + step \times n \le max$，其中 $n$ 為任意非負整數。

  若為 `"datetime"`、`"date"` 或 `"time"`，欄位值應同為整數。   若為 `"amount"` ，最終結果會依設置調整為整數。

- `"string"`：
  - `"regex"`：應符合的正則表達式

### 欄位群組

使用 `$col-group` 建立欄位群組：

```json
{
  "$": "col-group",
  "group": {
    "target": "identifier",

    "name": "...",
    "description": "...",
    "hidden": false,

    "columns": []
  }
}
```

- `"target`：寫入的識別符
- `"name"`：欄位群組名稱
- `"description"`：欄位群組說明
- `"hidden"`：是否顯示該欄位群組
- `"columns"`：包含多個表單欄位物件的陣列

### 推薦選項物件

使用 `$suggest-option` 建立推薦選項物件：

```json
{
  "$": "suggest-option",
  "option": {
    "value": "expr",
    "name": "...",
    "description": "..."
  }
}
```

- `"value"`：該選項的值
- `"name"`：該選項的名稱
- `"description"`：該選項的說明

### 分錄行物件

使用 `$entry-line` 建立分錄行物件：

```json
{
  "$": "entry-line",
  "entry-line": {
    "account": "expr",
    "tag": "expr",
    "amount": "expr",
    "note": "..."
  }
}
```

- `"account"`：該分錄行的科目
- `"tag"`：該分錄行的標籤（預設值為 `undefined`，將使用指定的預設標籤）
- `"amount"`：該分錄行的金額，需使用金額物件
- `"note"`：該分錄行的筆記

## 運算

所有運算一定會一個 `$` 屬性。

以下情況將忽略該運算，並回傳 `undefined`：

- 如果沒有包含任何合法的指令
- 如果指令缺少需要的值，或型別錯誤

### 條件分支

使用 `$if` 用於分支運算：

```json
{ "$": "if", "cond": "condition", "then": "expression", "else": "expression" }
```

- `"cond"`：用於判斷的值（預設值為 `undefined`）
- `"then"`：`"cond"` 為真值的求值表達式（預設值為 `undefined`）
- `"else"`：`"cond"` 為假值的求值表達式（預設值為 `undefined`）

執行時，會先對 `$cond` 進行求值，而後根據其結果對 `"then"` 或 `"else"` 求值。

### 條件循環

使用 `$while` 用於分支運算：

```json
{ "$": "while", "cond": "condition", "do": "expression" }
```

- `"cond"`：用於判斷的求值表達式
- `"do"`：條件成立時的求值表達式（預設值為 `undefined`）

每次執行時，會先對 `"cond"` 進行求值，而成立則對 `"do"` 進行求值。

回傳值為迴圈每次的求值結果陣列。

可以利用外部變數控制迴圈：

```json
[
  { "$": "set", "target": "running", "value": true },
  {
    "$": "while",
    "cond": { "$": "get", "target": "running" },
    "do": ["...", { "$": "set", "target": "running", "value": false }]
  }
]
```

### 迴圈映射

使用 `$for` 依次取出序列元素，並指派到指定位置：

```json
{
  "$": "for",
  "iters": ["iterable1", "iterable2", "..."],
  "as": ["identifier1", "identifier2", "..."],
  "do": "expression"
}
```

- `"iters"`：裝有多個字串或陣列的陣列
- `"as"`：裝有多個字串的陣列，將作為指派對象（預設值為 `[]`）
- `"do"`：求值表達式（預設值為 `undefined`）

為了解析器設計輕量，`$for` 會直接利用 `$set` 將序列元素寫入全域上下文，再重複利用 `"do"` 產生值。若 `"as"` 中的變數名稱與外層變數衝突，將會覆寫外層變數。

```json
{
  "$": "for", "iters": [[1, 2, 3]], "as": ["i"],
  "do": {
    "$": "for", "iters": [[10, 20]], "as": ["i"], // 覆蓋外層變數
    "do": { "$get": "i" } // 只能取得 10、20
  }
}
```

回傳值為迴圈每次的求值結果陣列。

若 `$for` 的長度大於 `as`，雖仍會執行，但不會產生指派行為；若小於，則 `as` 中無法匹配的將被指派為 `undefined`。

可以配合 `range` 工具函數進行迭代：

```json
[
  { "$": "set", "target": "target", "value": 2 },
  { 
    "$for": [{ "$": "util", "util": "range", "params": { "to": 5 } }],
    "do": {
      "$": "set", "target": "target",
      "value": {
        "$": "add",
        "operands": [{"$": "get", "target": "target" }, {"$": "get", "target": "target" }]
      }
    }
  }
]
```

若給定的序列長度不同，以最長的序列為主要迭代對象。此時，較短序列所對應的 `"as"` 識別符，在該次迭代中會被賦值為 `undefined`。

### 回傳值

使用 `$return` 中斷模版運行，並指定該模版的回傳值。

```json
{ "$": "return", "value": "expression" }
```

- `"value"`：模版的回傳值

當解析器遇到 `$return` 時，會立即停止解析後續的 JSON 指令，並將給定表達式的求值結果拋回給呼叫端。

可以配合 `$run` 實現函數呼叫的效果。

### 識別符賦值

使用 `$set` 將指定的值寫入對應識別符：

```json
{ "$": "set", "target": "identifier", "value": "expr" }
```

- `"target"`：符合識別符規則的字串，待寫入的對象
- `"value"`：寫入的值（預設值為 `undefined`）

回傳值為 `"value"` 的取值結果。

### 識別符取值

使用 `$get` 對指定的識別符取值：

```json
{ "$": "get", "target": "identifier" }
```

- `"target"`：符合識別符規則的字串，取值對象

回傳值為指定識別符的取值結果。

### 屬性賦值

使用 `$set-prop` 將指定的值寫入對應屬性：

```json
{ "$": "set-prop", "target": "expression", "prop": "identifier", "value": "expr" }
```

- `"target"`：待取屬性的物件
- `"prop"`：符合識別符規則的字串，待寫入的對象
- `"value"`：寫入的值（預設值為 `undefined`）

回傳值為 `"value"` 的值。

### 屬性取值

使用 `$get-prop` 對指定的屬性取值：

```json
{ "$": "get-prop", "target": "expression", "prop": "identifier" }
```

- `"target"`：待取屬性的物件
- `"prop"`：符合識別符規則的字串，取值對象

回傳值為指定屬性的取值結果。

### 一元運算

以下運算接受一個值，並回傳對應結果：

```json
{ "$": "%unary-op%", "operand": "expression" }
```

如果無法求值，或求值對象不合法（可能因為型別或量綱），回傳 `undefined`。

- 邏輯運算：
  - `"not"`：邏輯非，若為真值則回傳 `false`，否則回傳 `true`
- 數值運算：
  - `"abs"`：絕對值（無法作用於時間點）
  - `"neg"`：負數（無法作用於時間點）
  - `"int"`：向下取整。金額、時間點、時間差在系統內部已為整數域，作用後保持原值
- 陣列與字串：
  - `"rev"`：反轉陣列或字串
- 數值檢查：
  - `"is-undefined"`：檢查是否為 `undefined`

### 多元運算

以下運算接受一個陣列，並依次利用陣列元素求值：

```json
{ "$": "%n-ary-op%", "operands": ["expr1", "expr2", "..."] }
```

所有多元運算子皆嚴格遵循左結合律（Left-associative，由左向右逐一求值）。任何步驟若發生無法求值、型別不符或違反量綱代數規則，該表達式將立即安全降級並回傳 `undefined`。

- 全等判斷：
  - `"eq"`：若所有元素相等則回傳 `true`，否則為 `false`
  - `"ne"`：若所有元素兩兩不相等則回傳 `true`，否則為 `false`
- 數值運算：
  - `"add"`：以第一個值為初始值，依次加上下一個值
  - `"sub"`：以第一個值為初始值，依次減去下一個值
  - `"mul"`：以第一個值為初始值，依次乘上下一個值
  - `"div"`：以第一個值為初始值，依次除以下一個值
  - `"idiv"`：以第一個值為初始值，依次除以下一個值並向下取整
  - `"mod"`：以第一個值為初始值，依次利用下一個值取餘數
- 單調性比較：
  - `"lt"`：若每個元素小於其下一個元素，則回傳 `true`；否則回傳 `false`
  - `"gt"`：若每個元素大於其下一個元素，則回傳 `true`；否則回傳 `false`
  - `"le"`：若每個元素小於或等於其下一個元素，則回傳 `true`；否則回傳 `false`
  - `"ge"`：若每個元素大於或等於其下一個元素，則回傳 `true`；否則回傳 `false`
- 邏輯運算：
  - `"and"`：由左向右求值，遇到第一個假值立即短路回傳該假值；若全為真，回傳最後一個元素
  - `"or"`：由左向右求值，遇到第一個真值立即短路回傳該真值；若全為假，回傳最後一個元素
  - `"xor"`：若有奇數個真值回傳 `true`，否則為 `false`
- 陣列與字串：
  - `"cat"`：串接陣列或字串

### 陣列操作

對於以下運算，若提供的並非陣列，則回傳 `undefined`。

使用 `$clear` 清空陣列的元素：

```json
{ "$": "clear", "target": "array" }
```

- `"target"`：待清空的陣列

回傳被清空的陣列。

使用 `$insert` 在陣列的指定位置插入值：

```json
{ "$": "insert", "target": "array", "index": "expr", "value": "expr" }
```

- `"target"`：目的地陣列
- `"index"`：插入位置（預設值為 `-1`）
- `"value"`：待追加的值

將指定值插入指定位置，並回傳新的陣列長度。若為索引負值則加上陣列長度再額外加 1，使得利用相同索引能使用 `$peek` 取得插入值。

若索引加上陣列長度仍為負值，則視為插入於開頭；若索引超出陣列長度，則視為追加在最後。

使用 `$peek` 取得陣列在指定索引的值：

```json
{ "$": "peek", "target": "array", "index": "expr" }
```

- `"target"`：陣列或字串
- `"index"`：索引（預設值為 `-1`）

回傳陣列在指定索引的值。若為索引負值則加上陣列長度。若索引加上陣列長度仍為負值或超出陣列長度，則回傳 `undefined`。

使用 `$pop` 將陣列的指定位置的值彈出：

```json
{ "$": "pop", "target": "array", "index": "expr" }
```

- `"target"`：待修改陣列
- `"index"`：彈出位置（預設值為 `-1`）

回傳陣列在指定索引的值。若為索引負值則加上陣列長度。

若索引加上陣列長度仍為負值，則視為彈出開頭值；若索引超出陣列長度，則視為彈出結尾值。若為空陣列則回傳 `undefined`。

使用 `$remove` 移除陣列指定位置的值：

```json
{ "$": "remove", "target": "array", "index": "expr" }
```

- `"target"`：待修改陣列
- `"index"`：彈出位置（預設值為 `-1`）

將刪除指定位置的值，並回傳新的陣列長度。若索引加上陣列長度仍為負值或超出陣列長度，則忽略刪除行為。

使用 `$slice` 收集陣列指定區間的成員：

```json
{ "$": "slice", "target": "array", "from": 1, "to": 5, "step": 2 }
```

- `"target"`：陣列或字串
- `"from"`：區間起始索引（預設值為 `0`）
- `"to"`：區間結尾索引，不包含，若為值則加上陣列長度再額外加 1（預設值為 `-1`）
- `"step"`：跨步（預設值為 `1`）

收集指定區間的元素為陣列，並回傳。

### 啟動表單

使用 `$form` 建立並顯示輸入表單：

```json
{
  "$": "form",
  "title": "...",
  "description": "...",
  "columns": []
}
```

- `"title"`：表單的標題
- `"description"`：表單的描述或提示文字（選填）
- `"columns"`：包含多個表單欄位物件的陣列

執行時，向使用者顯示表單，等待使用者提交後，將各欄位值以鍵值對（Key-Value）形式封裝成一個物件，並回傳。

### 查詢

使用 `$search-transaction` 查詢交易：

```json
{ "$": "search-transaction", "uuid": "expression" }
```

- `"uuid"`：待查詢的交易識別編號

如果存在，回傳該交易，否則回傳 `undefined`

使用 `$search-account` 查詢科目：

```json
{ "$": "search-account", "uuid": "expression" }
```

- `"uuid"`：待查詢的科目識別編號

如果存在，回傳該科目，否則回傳 `undefined`

使用 `$search-tag` 查詢標籤：

```json
{ "$": "search-tag", "uuid": "expression" }
```

- `"uuid"`：待查詢的標籤識別編號

如果存在，回傳該標籤，否則回傳 `undefined`

### 建立任務

使用 `$create-task` 建立任務：

```json
{
  "$": "create-task",
  "task": "create-notification",

  "scheduled": {
    "cron": "0 0 */5 * *",
    "repetitions": 1
  },

  "notification": {
    "title": "...",
    "content": "...",
    "scripts": [],
    "defaults": {}
  }
}
```

- `"task"`：要新增的任務
  - `"create-notification"`：建立通知
- `"scheduled"`：為 `false` 時不建立為排程，指定一個物件表示排程設置
  - `"cron"`：標準 5 欄位 Cron 運算式
  - `"repetitions"`：重覆次數，為負數時表示無次數限制（預設值為 `1`）
- `"notification"`：通知內容，當 `"task"` 為 `"create-notification"` 使用
  - `"title"`：通知標題
  - `"content"`：通知內容
  - `"scripts"`：通知確認時，將會運行的指令（預設值為 `[]`）
  - `"defaults"`：包含數個鍵值對的物件，將作為運行指令時的上下文（預設值為 `{}`）

`"scripts"` 中的所有字串字面量（包括 JSON 物件字面量的屬性）以及指令將保留到通知運行時，才利用當下的上下文解析。

回傳 `true`。

### 建立分錄

使用 `$create-entry` 建立分錄：

```json
{
  "$": "create-entry",
  "entry-lines": [],
  "transcation": "expression",
  "description": ""
}
```

- `"entry-lines"`：包含多個分錄行物件的陣列
- `"transcation"`：來源交易
- `"description"`：分錄說明

執行時，向使用者顯示一個可修改的分錄新增提示，並等待使用者操作。

若使用者在修改後，同意新增分錄，則會回傳 `true`；若不同意則回傳 `false`。

若設定的分錄不平衡、或有重覆的科目與標籤組合，則不會顯示分錄新增提示，並直接回傳 `undefined`。

### 調用工具函數

使用 `$util` 調用內建工具函數：

```json
{
  "$": "util",
  "util": "function-name",
  "params": {
    "param1": "expr1",
    "param2": "expr2"
  }
}
```

- `"util"`：欲調用的內建工具函數名稱字串
- `"params"`：傳入工具函數的參數

### 調用交易模版

使用 `$run` 調用其他交易模版，實現類似函數呼叫的效果：

```json
{
  "$": "run",
  "template": "template-code",
  "defaults": {
    "param1": "expr1",
    "param2": "expr2"
  }
}
```

- `"template"`：欲調用的交易模版代碼（`code`）
- `"defaults"`：傳遞給被呼叫模版的預設值，作為其初始上下文變數

當執行到 `$run` 時，會跳轉至指定的交易模版執行，並在該模版結束（或遇到 `$return`）後，將其回傳值作為本運算式的結果返回。

執行外部交易模版時，有獨立的上下文。

若該模版沒有使用 `$return` 指定回傳值，則回傳 `undefined`。

### 除錯

使用 `$log` 向終端輸出：

```json
{ "$": "log", "value": "expression" }
```

- `"value"`：任意輸出值

回傳值為 `"value"` 的值。


## 工具函數

### 折舊金額陣列

使用 `"depreciate"` 取得基於真線法或年數合計法的折舊金額陣列。

```json
{
  "$": "util",
  "util": "depreciate",
  "params": {
    "method": "straight",
    "cost": 10000,
    "periods": 5,
    "residual": 0,
    "first": 1
  }
}
```

- `"method"`：折舊方式
  - `"straight"`：直線法（預設）
  - `"sum-of-year"`：年數合計法
- `"cost"`：總成本
- `"periods"`：折舊期數（預設值為 `1`）
  - 若 `"first"` 為 `1`，則回傳陣列長度為 `periods`；
  - 若 `"first"` 小於 `1`，則回傳陣列長度為 `periods + 1`（包含末期）
- `"residual"`：殘值（預設值為 `0`）
- `"first"`：數值，第一期與標準期間長度的比例（預設值為 `1`）
  - `1` 表示期初購入
  - 接近 `0` 表示期末購入

回傳一個折舊金額陣列，其總和恰為折舊總額，受帳本捨入規則影響。

使用 `"ratio-depreciate"` 取得基於倍數餘額遞減法的折舊金額陣列。

```json
{
  "$": "util",
  "util": "ratio-depreciate",
  "params": {
    "rate": 1.5,
    "cost": 10000,
    "periods": 5,
    "residual": 0,
    "first": 1
  }
}
```

- `"rate"`：折舊倍數，應為大於 1 的實數（預設值為 2）
- `"cost"`：總成本
- `"periods"`：折舊期數（預設值為 `1`）
  - 若 `"first"` 為 `1`，則回傳陣列長度為 `periods`；
  - 若 `"first"` 小於 `1`，則回傳陣列長度為 `periods + 1`（包含末期）
- `"residual"`：殘值（預設值為 `0`）
- `"first"`：數值，第一期與標準期間長度的比例（預設值為 `1`）
  - `1` 表示期初購入
  - 接近 `0` 表示期末購入

回傳一個折舊金額陣列，其總和恰為折舊總額，受帳本捨入規則影響。

### 迭代相關

使用 `"range"` 產生指定區間內的整數數值陣列，常用於迴圈迭代。

```json
{
  "$": "util",
  "util": "range",
  "params": {
    "from": 0,
    "to": 5,
    "step": 1
  }
}
```

- `"from"`：起始值（預設值為 `0`）
- `"to"`：終點值，回傳的陣列不包含此值
- `"step"`：跨步值（預設值為 `1`）


回傳一個陣列，成員為符合 $from + k \times step \lt to$ 的數值。

### 表單推建選項

使用 `"suggest-account"` 產生多個科目代碼的推薦選項物件：

```json
{
  "$": "util",
  "util": "suggest-account",
  "params": {
    "code": "...",
    "name": "...",
    "group-code": "...",
    "group-name": "..."
  }
}
```

- `"code"`：用於科目代碼的正則表達式（預設值為 `"*"`）
- `"name"`：用於科目名稱的正則表達式（預設值為 `"*"`）
- `"group-code"`：用於群組代碼的正則表達式（預設值為 `"*"`）
- `"group-name"`：用於群組名稱的正則表達式（預設值為 `"*"`）

回傳一個包含多個科目推薦選項物件的陣列，每個成員的代表的科目符合指定的所有表達式。科目的名稱與說明將會是推薦選項物件的名稱與說明。

使用 `"suggest-tag"` 產生多個科目代碼的推薦選項物件：

```json
{
  "$": "util", 
  "util": "suggest-tag",
  "params": {
    "code": "...",
    "name": "...",
    "group-code": "...",
    "group-name": "..."
  }
}
```

- `"code"`：用於標籤代碼的正則表達式（預設值為 `"*"`）
- `"name"`：用於標籤名稱的正則表達式（預設值為 `"*"`）
- `"group-code"`：用於群組代碼的正則表達式（預設值為 `"*"`）
- `"group-name"`：用於群組名稱的正則表達式（預設值為 `"*"`）

回傳一個包含多個標籤推薦選項物件的陣列，每個成員的代表的標籤符合指定的所有表達式。標籤的名稱與說明將會是推薦選項物件的名稱與說明。