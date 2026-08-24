# Industry Brief

用于保存自动生成的行业日报与周汇总数据。

## 内容范围

- 城市更新 / GIS
- AI 模型与工具
- 测绘 / 无人机

## 数据结构

```text
data/
├─ daily/          # 日报：YYYY-MM-DD.json
├─ weekly/         # 周报：YYYY-Www.json
├─ latest.json     # 最近一次生成结果
└─ index.json      # 日报/周报索引
```

## 自动化规则

- 非星期五：生成过去 24 小时行业日报
- 星期五：生成过去 7 天周汇总，并加入本周推荐阅读
