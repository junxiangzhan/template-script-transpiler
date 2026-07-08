# 模版腳本語言

模版腳本語言（Template Script Language）是快速交易模版指令集的高階語法，透過轉譯器轉換為 JSON 指令集後執行。本文件定義了模版腳本語言的語法規則與轉譯對應。

有關 JSON 指令集的詳細說明，請參考[快速交易模版](./templates.md)。

## 字面量

### 布林值

使用 `true` 表示真，`false` 表示假：

```
true
false
```

### 數字

使用數字字面量表示，可使用底線 `_` 作為數位分隔符以提升可讀性：

```
10000.25
10_000.25
```

### 字串

使用雙引號建立字串字面量。所有字串字面量皆支援 `%...%` 語法插入指定識別符的值，使用 `%%` 插入百分比符號：

```
"this is a string"
"He got %score% points in math test."
```

### 空值

使用 `null` 表示空值：

```
null
```

### 未定義

使用 `undefined` 表示未定義：

```
undefined
```

### 金額

使用 `$` 前綴建立金額字面量，可使用底線 `_` 作為數位分隔符。金額將按帳本規則捨入至指定小數：

```
$10_000.25
```

轉譯為：

```json
{ "$": "amount", "amount": 10000.25 }
```

亦可使用 `Amount` 建構式建立：

```
new Amount { "value": 100 }
```

### 時間點

使用 `@` 前綴搭配 ISO 8601 時間格式建立時間點字面量：

```
@2000-01-01T00:00:00.0000
```

轉譯為：

```json
{ 
  "$": "datetime",
  "datetime": {
    "year": 2000, 
    "month": 1, 
    "date": 1,
    "hour": 0,
    "minute": 0,
    "second": 0,
    "nanosecond": 0
  }
}
```

亦可使用 `Datetime` 建構式，以物件形式指定各時間欄位：

```
new Datetime {
  "year": 2000,
  "month": 1,
  "date": 1
}
```

轉譯為：

```json
{ "$": "datetime", "datetime": { "year": 2000, "month": 1, "date": 1 } }
```

各欄位的詳細說明請參考[快速交易模版#時間點](./templates.md#時間點)。

### 時間差

使用 `@` 前綴搭配 ISO 8601 時間差格式建立時間差字面量：

```
@p5dt2s
```

轉譯為：

```json
{ "$": "deltatime", "deltatime": { "days": 5, "hours": 0, "minutes": 0, "seconds": 2, "nanoseconds": 0 } }
```

亦可使用 `Deltatime` 建構式，以物件形式指定各欄位：

```
new Deltatime {
  "days": 100
}
```

各欄位的詳細說明請參考[快速交易模版#時間差](./templates.md#時間差)。

### 陣列

使用方括號建立陣列字面量，元素以逗號分隔：

```
[element1, element2, element3]
```

## 大括號的使用

語法中有三種使用大括號的場合：

- `do { }`：區塊表達式，內含以分號 `;` 分隔的表達式
- `{ }`：複合欄位，內含以逗號 `,` 分隔的鍵值對
- `{{ }}`：建立獨立物件（`$pack`）
- `new Identifier {}`：建立物件

解析器依據前綴即可區分上述三者，無需檢查內容。

複合欄位用於為建構式或函數呼叫提供附加屬性，其鍵值對將直接成為對應 JSON 指令的屬性，不會產生 `$pack` 物件。

## 物件建立

### 物件

使用雙大括號 `{{ }}` 建立獨立物件（`$pack`）。僅在需要建立可獨立存取的物件時使用：

```
{{
  "account": searchAccount("uuid": "..."),
  "amount": $100
}}
```

轉譯為：

```json
{
  "$": "pack",
  "pack": {
    "account": { "$": "search-account", "uuid": "..." },
    "amount": { "$": "amount", "amount": 100 }
  }
}
```

屬性名稱若包含 `.`，將會因為識別符的存取規則而無法取得。

### 表單欄位

使用 `Col` 系列建構式建立表單欄位物件。建構式名稱對應欄位型別，`=` 後方為寫入的識別符：

- `ColBoolean`：布林值欄位
- `ColNumber`：數值欄位
- `ColString`：字串欄位
- `ColTransaction`：交易欄位
- `ColAccount`：科目欄位
- `ColTag`：標籤欄位
- `ColDatetime`、`ColDate`：時間點欄位
- `ColTime`：時間差欄位
- `ColAmount`：金額欄位

以下範例建立一個布林值欄位，識別符以字串形式表示：

```
new ColBoolean { "target": "has been sold" }
```

轉譯為：

```json
{ "$": "col", "col"{ "target": "has been sold", "type": "boolean" } }
```

以下範例建立一個帶有驗證規則的數值欄位：

```
new ColNumber {
  "target": "count",
  "validation": {
    "min": 0,
    "step": 1
  }
}
```

轉譯為：

```json
{
  "$": "col",
  "col": {
    "target": "count",
    "type": "number",
    "validation": { "min": 0, "step": 1 }
  }
}
```

以下範例建立一個帶有推薦選項的標籤欄位：

```
new ColTag {
  "target": "provider"
  "suggestions": {
    "options": suggestTag("group-code": "provider"),
    "limited": true
  }
}
```

轉譯為：

```json
{
  "$": "col",
  "col": {
    "target": "provider",
    "type": "tag",
    "suggestions": {
      "options": { "$": "util", "util": "suggest-tag", "params": { "group-code": "provider" } },
      "limited": true
    }
  }
}
```

各欄位屬性的詳細說明請參考 [快速交易模版#欄位物件](./templates.md#欄位物件)。

### 欄位群組

使用 `ColGroup` 建構式建立欄位群組，`=` 後方為寫入的識別符：

```
new ColGroup {
  "target": "group",
  "name": "...",
  "description": "...",
  "columns": []
}
```

轉譯為：

```json
{
  "$": "col-group",
  "group": {
    "target": "group",
    "name": "...",
    "description": "...",
    "columns": []
  }
}
```

### 推薦選項

使用 `ColSuggestOption` 建構式建立推薦選項物件：

```
new ColSuggestOption {
  "value": $250,
  "name": "...",
  "description": "..."
}
```

轉譯為：

```json
{
  "$": "suggest-option",
  "option": {
    "value": { "$": "amount", "amount": 250 },
    "name": "...",
    "description": "..."
  }
}
```

### 分錄行

使用 `EntryLine` 建構式建立分錄行物件：

```
new EntryLine {
  "account": searchAccount("uuid": "..."),
  "tag": searchTag("uuid": "..."),
  "amount": $100,
  "note": "..."
}
```

轉譯為：

```json
{
  "$": "entry-line",
  "entry-line": {
    "account": { "$": "search-account", "uuid": "..." },
    "tag": { "$": "search-tag", "uuid": "..." },
    "amount": { "$": "amount", "amount": 100 },
    "note": "..."
  }
}
```

## 識別符

識別符為不包含 `.` 的字串，用於變數的存取。

不含特殊字元的識別符可以直接書寫：

```
aIdentifierWithoutSpecialCharacter
```

包含特殊字元（如 `=`、`#`、空白、`%` 等）的識別符，使用單引號包裹，並遵循字串的 `%...%` 插入與跳脫規則：

```
'a=identifier#with-special%%Character'
```

### 屬性存取

使用 `.` 串接識別符，以讀取或寫入指定的屬性或索引：

```
myObject.property
myArray.0
myArray.length
```

轉譯為：

```json
{ "$": "get", "target": "myObject.property" }
{ "$": "get", "target": "myArray.0" }
{ "$": "get", "target": "myArray.length" }
```

### 保留識別符

以下識別符為系統保留，無法被覆寫。

建構式識別符：

- `Datetime`：時間點建構式
- `Deltatime`：時間差建構式
- `Amount`：金額建構式
- `ColBoolean`、`ColNumber`、`ColString`、`ColTransaction`、`ColAccount`、`ColTag`、`ColDatetime`、`ColDate`、`ColTime`、`ColAmount`：表單欄位建構式
- `ColGroup`：欄位群組建構式
- `ColSuggestOption`：推薦選項建構式
- `EntryLine`：分錄行建構式

內建函數識別符：

- `clear`：清空陣列
- `insert`：在陣列指定位置插入值
- `peek`：取得陣列指定索引的值
- `pop`：彈出陣列指定位置的值
- `remove`：移除陣列指定位置的值
- `slice`：收集陣列指定區間的元素
- `form`：建立並顯示輸入表單
- `searchTransaction`：查詢交易
- `searchAccount`：查詢科目
- `searchTag`：查詢標籤
- `createTask`：建立任務
- `createEntry`：建立分錄
- `log`：向終端輸出
- `depreciate`：取得直線法或年數合計法的折舊金額陣列
- `ratioDepreciate`：取得倍數餘額遞減法的折舊金額陣列
- `range`：產生指定區間的整數數值陣列
- `suggestAccount`：產生科目推薦選項物件陣列
- `suggestTag`：產生標籤推薦選項物件陣列

存取此些保留識別符時，不能使用字串的 `%...%` 插入規則實現動態函數呼叫。  
也無法利用 `$get` 或 `$set` 存取。

## 定義

### 模版

使用 `template` 定義一個對使用者可見的交易模版。參數皆為具名參數，可指定預設值：

```
template myTemplate(
  param1 = "default value",
) <expr>
```

- `template`：對使用者可見的模版定義
- 參數名稱為識別符，`=` 後方為預設值

轉譯時，將產生一個 `"hidden": false` 的交易模版，其 `"script"` 為模版本體的轉譯結果。

### 函數

使用 `function` 定義一個對使用者隱藏的模版，作為內部函數使用：

```
function myHelper(
  param1 = "default value",
) <expr>
```

- `function`：對使用者隱藏的模版定義（等同於 `"hidden": true` 的交易模版）
- 參數名稱為識別符，`=` 後方為預設值

函數與模版在行為上一致，僅有可見性的差異。呼叫時使用獨立的上下文。

## 表達式

### 區塊

使用 `do` 前綴搭配大括號 `{ }` 建立區塊表達式，內含多個以分號 `;` 分隔的表達式。區塊的回傳值為最後一個表達式的求值結果：

```
do {
  expr1;
  expr2;
  expr3;
}
```

轉譯為陣列形式，回傳值為陣列最後一個元素的求值結果。

### 條件分支

使用 `if` 進行條件分支，可選搭配 `else`：

```
if (condition) <expr>
if (condition) <expr> else <expr>
if !(condition) <expr>
if !(condition) <expr> else <expr>
```

轉譯為：

```json
{ "$": "if", "cond": "condition", "then": "expr", "else": "expr" }
```

### 條件循環

使用 `while` 進行條件循環：

```
while (condition) <expr>
while !(condition) <expr>
```

轉譯為：

```json
{ "$": "while", "cond": "condition", "do": "expr" }
```

回傳值為迴圈每次的求值結果陣列。

### 迴圈映射

使用 `for` 依次取出序列元素，並指派到指定識別符：

```
for (ident1 in iterable1, ident2 in iterable2) <expr>
```

轉譯為：

```json
{ "$": "for", "iters": ["iterable1", "iterable2"], "as": ["ident1", "ident2"], "do": "expr" }
```

回傳值為迴圈每次的求值結果陣列。

為了解析器設計輕量，`for` 會直接將序列元素寫入全域上下文。若識別符與外層變數衝突，將會覆寫外層變數。

### 回傳值

使用 `return` 中斷模版運行，並指定回傳值：

```
return <expr>
```

轉譯為：

```json
{ "$": "return", "value": "expr" }
```

### 賦值

使用 `=` 將值寫入指定識別符或屬性：

```
myVariable = true
myArray.0 = 42
myObject.property = "value"
```

轉譯為：

```json
{ "$": "set", "target": "myVariable", "value": true }
{ "$": "set", "target": "myArray.0", "value": 42 }
{ "$": "set", "target": "myObject.property", "value": "value" }
```

回傳值為賦值的結果。

### 一元運算

以下一元算子接受一個值，並回傳對應結果。如果無法求值或求值對象不合法，回傳 `undefined`：

邏輯運算：

```
!<expr>
```

轉譯為 `$not`。若為真值則回傳 `false`，否則回傳 `true`。

數值運算：

```
-<expr>
abs <expr>
int <expr>
```

- `-`：轉譯為 `$neg`，取負數（無法作用於時間點）
- `abs`：轉譯為 `$abs`，取絕對值（無法作用於時間點）
- `int`：轉譯為 `$int`，向下取整

陣列與字串：

```
rev <expr>
```

- `rev`：轉譯為 `$rev`，反轉陣列或字串

### 二元運算

以下二元算子接受兩個值，遵循左結合律。任何步驟若發生無法求值、型別不符或違反量綱代數規則，將回傳 `undefined`。

全等判斷：

```
<expr> == <expr>
```

轉譯為 `$eq`。若兩個值相等則回傳 `true`，否則為 `false`。

不等判斷：

```
<expr> != <expr>
```

`!=` 可以串接多個，判斷其中元素是否兩兩不相等。例如 `a != b != c` 將轉譯為 `{"$": "ne", "operands": [a, b, c]}`。

數值運算：

```
<expr> + <expr>
<expr> - <expr>
<expr> * <expr>
<expr> / <expr>
<expr> // <expr>
<expr> % <expr>
```

- `+`：轉譯為 `$add`，加法
- `-`：轉譯為 `$sub`，減法
- `*`：轉譯為 `$mul`，乘法
- `/`：轉譯為 `$div`，除法
- `//`：轉譯為 `$idiv`，整數除法（向下取整）
- `%`：轉譯為 `$mod`，取餘數

串接：

```
<expr> ++ <expr>
```

轉譯為 `"cat`。串接陣列或字串。

單調性比較：

```
<expr> < <expr> [< <expr> ...]
<expr> <= <expr> [<= <expr> ...]
<expr> > <expr> [> <expr> ...]
<expr> >= <expr> [>= <expr> ...]
```

相同方向的比較運算子可直接串接。例如 `a < b < c` 轉譯為 `{ "$": "lt", "operands": [a, b, c] }`，表示嚴格遞增。

- `<`：轉譯為 `$lt`
- `<=`：轉譯為 `$le`
- `>`：轉譯為 `$gt`
- `>=`：轉譯為 `$ge`

邏輯運算：

```
<expr> & <expr>
<expr> | <expr>
<expr> ^ <expr>
```

- `&`：轉譯為 `$and`，邏輯與（短路求值）
- `|`：轉譯為 `$or`，邏輯或（短路求值）
- `^`：轉譯為 `$xor`，邏輯互斥或

### 函數呼叫

所有函數呼叫使用統一的具名參數語法，參數以 `"key": value` 形式傳入，多個參數以逗號分隔：

```
<identifier>(<key1>: <expr1>, <key2>: <expr2>, ...)
```

此語法適用於以下所有呼叫：

內建函數呼叫，例如：

```
insert("array": myArray, "index": 0, "value": 42)
peek("array": myArray, "index": -1)
clear("array": myArray)
slice("array": myArray, "from": 1, "to": 5, "step": 2)
```

表單呼叫：

```
form("title": "記帳", "columns": [
  ColAmount='金額' { "default": 100 },
  ColAccount='科目'
])
```

查詢呼叫：

```
searchAccount("uuid": "...")
searchTag("uuid": "...")
```

任務建立：

```
createTask(
  "type": "create-notification",
  "scheduled": { "cron": "0 0 */5 * *", "repetitions": -1 },
  "notification": {
    "title": "月結提醒",
    "content": "請確認本月帳務",
    "scripts": do {
      log("執行提醒腳本");
      createEntry(
        "lines": [
          EntryLine { "account": searchAccount("uuid": "..."), "amount": $100 },
          EntryLine { "account": searchAccount("uuid": "..."), "amount": -$100 }
        ]
      );
    }
  }
)
```

分錄建立：

```
createEntry(
  "lines": [
    EntryLine { "account": searchAccount("uuid": "..."), "amount": $100 },
    EntryLine { "account": searchAccount("uuid": "..."), "amount": -$100 }
  ],
  "transaction": myTransaction,
  "description": "..."
)
```

工具函數呼叫：

```
depreciate("method": "straight", "cost": 10000, "periods": 5, "residual": 0)
ratioDepreciate("rate": 1.5, "cost": 10000, "periods": 5)
range("from": 0, "to": 5, "step": 1)
suggestAccount("group-code": "11")
suggestTag("group-code": "provider")
```

模版與函數呼叫：

```
myTemplate("param1": value1, "param2": value2)
myHelper("param1": value1)
```

轉譯為：

```json
{ "$": "run", "template": "myTemplate", "defaults": { "param1": "value1", "param2": "value2" } }
```

除錯呼叫：

```
log(myVariable)
```

轉譯為：

```json
{ "$": "log", "value": { "$": "get", "target": "myVariable" } }
```

各函數的詳細行為與參數說明，請參考 [快速交易模版](./templates.md) 中對應的章節。