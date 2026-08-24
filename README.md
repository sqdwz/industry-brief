# 信息聚合中心

静态前端第一阶段：统一视觉框架、空域信息，以及行业日报与周汇总、城市更新、政策面板的接入占位。

## 本地预览

```powershell
cd F:\A2\ppt创建\information-hub
python -m http.server 4173 --bind 127.0.0.1
```

打开 `http://127.0.0.1:4173/`。

## 数据接口预留

生产站点优先读取 Cloudflare KV 中的 `/data/airspace.json`。Cloudflare Worker 每 15 分钟从 `sqdwz/hainan-airspace` 主分支的 `data/latest.json` 同步一次：GitHub 用作可追溯的更新源，Cloudflare 保留一份可直接访问的最新副本。若 Cloudflare 首次同步失败，Worker 会回退到随站点发布的 `data/airspace.json`；浏览器端最后才会直连 GitHub。

每个空域事件都有独立 `sources` 数组，支持一个事件对应多个来源，且优先显示官方来源。
